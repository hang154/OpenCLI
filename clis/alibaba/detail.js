import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';

const READ_DETAIL = `(() => ({url:location.href,title:document.title,text:(document.body?.innerText||'').slice(0,40000),links:[...document.querySelectorAll('a[href]')].filter(a=>/company|supplier|store|shop|profile|winport|公司|店铺|상점|공급업체/i.test((a.innerText||'')+' '+a.href)).slice(0,100).map(a=>({text:(a.innerText||'').slice(0,150),url:a.href}))}))()`;

const SLIDER_GEOMETRY = `(() => {const s=document.getElementById('nc_1_n1z'),w=document.getElementById('nc_1_wrapper');if(!s||!w)return null;const r=s.getBoundingClientRect(),o=w.getBoundingClientRect();if(r.width<=0||o.width<=0)return null;return {x:r.left+r.width/2,y:r.top+r.height/2,end:o.right-r.width/2-3};})()`;

export function isVerificationPage(state) {
  const title = String(state?.title || ''), text = String(state?.text || '');
  return /captcha|punish|_____tmd_____/i.test(String(state?.url || ''))
    || /captcha|verify (?:you are|your identity)|slide to verify|验证码|滑动验证|밀어서 확인|비정상적인 트래픽/i.test(title + '\n' + text.slice(0, 2000));
}

export function parseProductUrl(input) {
  let url; try { url = new URL(String(input || '')); } catch { return null; }
  if (url.protocol !== 'https:' || !(url.hostname === 'alibaba.com' || url.hostname.endsWith('.alibaba.com'))) return null;
  const product_id = url.pathname.match(/^\/product-detail\/(?:.+_)?(\d+)\.html$/)?.[1];
  if (!product_id) return null;
  url.search = ''; url.hash = '';
  return { product_id, url: url.href };
}

const sleep = ms => new Promise(done => setTimeout(done, ms));

/**
 * Clear the baxia "밀어서 확인하기" punish slider with one human-like
 * CDP pointer trajectory (26 eased mousemove steps with small jitter and
 * varied dwell). Trusted-event requirement means a real Input.dispatchMouseEvent
 * sequence is mandatory; synthetic DOM events are rejected by the widget.
 */
export async function solvePunishSlider(page) {
  if (typeof page.cdp !== 'function') return false;
  const geo = await page.evaluate(SLIDER_GEOMETRY);
  if (!geo || !(geo.end > geo.x)) return false;
  const move = (type, x, y, extra) => page.cdp('Input.dispatchMouseEvent',
    { type, x: Math.round(x), y: Math.round(y), ...(extra || {}) });
  await move('mouseMoved', geo.x, geo.y); await sleep(90);
  await move('mousePressed', geo.x, geo.y, { button: 'left', clickCount: 1 }); await sleep(60);
  const total = geo.end - geo.x, steps = 26;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const jitterX = Math.sin(t * 9) * 1.2;
    const jitterY = i % 7 === 0 ? -1 : i % 11 === 0 ? 1 : 0;
    await move('mouseMoved', geo.x + total * ease + jitterX, geo.y + jitterY, { button: 'left', buttons: 1 });
    await sleep(8 + ((i * 13) % 17));
  }
  await move('mouseMoved', geo.end, geo.y, { button: 'left', buttons: 1 }); await sleep(90);
  await move('mouseMoved', geo.end - 1, geo.y + 1, { button: 'left', buttons: 1 }); await sleep(60);
  await move('mouseReleased', geo.end, geo.y, { button: 'left', clickCount: 1 });
  await page.wait(3.5);
  return true;
}

export async function readViaMirror(url, { timeoutMs = 45000, fetchImpl = (...a) => globalThis.fetch(...a) } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('https://r.jina.ai/' + url, { headers: { Accept: 'text/plain' }, signal: controller.signal });
    if (!response.ok) throw new CommandExecutionError('Text mirror returned HTTP ' + response.status, 'Retry later; the mirror is only a fallback for direct browser access.');
    return await response.text();
  } finally { clearTimeout(timer); }
}

export const detailCommand = cli({
  site: 'alibaba', name: 'detail', access: 'read', domain: 'www.alibaba.com',
  description: 'Read one Alibaba product detail page; clears the punish slider when possible, otherwise records a text-mirror snapshot',
  strategy: Strategy.COOKIE, navigateBefore: false,
  args: [{ name: 'url', required: true, positional: true, help: 'Alibaba product-detail URL' },
    { name: 'save-mirror-to', help: 'Optional local path for the raw mirror snapshot text' },
    { name: 'mirror-timeout', type: 'int', default: 45000, help: 'Mirror fetch timeout in ms (5000-90000)' }],
  columns: ['product_id', 'item_url', 'observed_via', 'verification_cleared', 'page', 'mirror'],
  func: async (page, args) => {
    const target = parseProductUrl(args.url);
    if (!target) throw new CommandExecutionError('Use an https://www.alibaba.com/product-detail/... product URL');
    const saveTo = args['save-mirror-to'] ? String(args['save-mirror-to']) : null;
    const timeoutMs = Math.min(90000, Math.max(5000, Number(args['mirror-timeout'] ?? 45000)));
    await page.goto(target.url);
    await page.wait(2.5);
    let state = await page.evaluate(READ_DETAIL);
    let observedVia = 'browser', cleared = false, attempts = 0;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      if (!isVerificationPage(state)) break;
      attempts = attempt;
      if (!await solvePunishSlider(page).catch(() => false)) break;
      await page.wait(2);
      state = await page.evaluate(READ_DETAIL);
      if (isVerificationPage(state)) { await page.goto(target.url).catch(() => {}); await page.wait(2.5); state = await page.evaluate(READ_DETAIL); }
      if (!isVerificationPage(state)) { observedVia = 'browser_after_slider'; cleared = true; break; }
    }
    if (!isVerificationPage(state)) {
      if (!state.url.includes(target.product_id))
        throw new CommandExecutionError('Product ID not retained in destination URL; page identity unconfirmed');
      return { product_id: target.product_id, item_url: target.url, observed_via: observedVia, verification_cleared: cleared, slider_attempts: attempts, page: state, mirror: null };
    }
    const text = await readViaMirror(target.url, { timeoutMs });
    if (!text || text.length < 2000 || !text.includes(target.product_id))
      throw new CommandExecutionError('Text mirror did not return this product page', 'The marketplace still requires interactive verification; retry later.');
    const evidence = { mirror_url: 'https://r.jina.ai/' + target.url, fetched_at: new Date().toISOString(), bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') };
    if (saveTo) { writeFileSync(saveTo, text); evidence.save_path = saveTo; }
    const truncated = text.slice(0, 80000);
    return { product_id: target.product_id, item_url: target.url, observed_via: 'text_proxy', verification_cleared: false, slider_attempts: attempts,
      page: { url: target.url, title: (text.match(/^Title:\s*(.*)$/m) || [, ''])[1], text: truncated, links: [] }, mirror: evidence };
  },
});
