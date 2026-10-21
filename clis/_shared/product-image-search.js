import { readFileSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { ArgumentError, AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';

export function validateImage(input) {
  const path = resolve(String(input || ''));
  let data;
  try {
    if (!statSync(path).isFile() || statSync(path).size > 10 * 1024 * 1024) throw new Error('size');
    data = readFileSync(path);
  } catch { throw new ArgumentError('Image must be an existing regular file, at most 10 MiB'); }
  const hex = data.subarray(0, 12).toString('hex');
  const type = hex.startsWith('ffd8ff') ? 'jpeg' : hex.startsWith('89504e470d0a1a0a') ? 'png'
    : data.subarray(0, 2).toString() === 'BM' ? 'bmp'
    : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null;
  const extensions = {jpeg:['.jpg','.jpeg'], png:['.png'], bmp:['.bmp'], webp:['.webp']};
  if (!type || !extensions[type].includes(extname(path).toLowerCase()))
    throw new ArgumentError('Use a JPEG, PNG, BMP or WebP with matching file signature and extension');
  return {path, sha256:createHash('sha256').update(data).digest('hex'), bytes:data.length, mime:'image/' + type};
}

export function isImageResultUrl(site, href) {
  try {
    const u = new URL(href);
    if (u.protocol !== 'https:' || !(u.hostname === site + '.com' || u.hostname.endsWith('.' + site + '.com'))) return false;
    if (site === 'alibaba') return u.pathname === '/search/page' && u.searchParams.get('SearchScene') === 'imageTextSearch' && !!u.searchParams.get('imagePath');
    return u.hostname === 's.1688.com' && /youyuan|selloffer/.test(u.pathname)
      && [...u.searchParams].some(([k,v]) => /image(address|id|path)|tab/i.test(k) && /image|https?:|^[a-z0-9_-]{10,}$/i.test(v));
  } catch { return false; }
}
export function assertSearchPage(state) {
  if (/captcha|punish|_____tmd_____|login\.|passport|member\/signin/i.test(state.href)
    || /verify (?:you are|your identity)|slide to verify|验证码|滑动验证/i.test(state.title + state.text)
    || state.loginFrame) throw new AuthRequiredError('product image search', 'Complete login/verification in the existing browser, then retry.');
}

export async function searchByImage(page, args, site, readRows) {
  const image = validateImage(args.image), limit = Number(args.limit ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ArgumentError('limit must be 1–100');
  if (!page.uploadFiles && !page.setFileInput) throw new CommandExecutionError('Browser file upload is unavailable');
  await page.goto('https://www.' + site + '.com/'); await page.wait(2);
  if (site === '1688') {
    const cookies = await page.getCookies({url:'https://www.1688.com/'});
    if (!cookies.some(c => c.name === '__cn_logon__' && c.value === 'true'))
      throw new AuthRequiredError('1688.com', 'Sign in to 1688 in the connected browser before image search.');
  }
  const selector = site === '1688' ? 'input[type="file"][aria-label="以图搜款"]' : 'input[type="file"][name="image-search-upload"]';
  if (site === 'alibaba') {
    const opened = await page.evaluate(`(() => {const b=document.querySelector('[data-search="switch-image-upload"]'); if(!b)return false; b.click(); return true})()`);
    if (!opened) throw new CommandExecutionError('Alibaba image search control missing; page layout or access changed');
    await page.wait(0.5);
  }
  const before = page.tabs ? await page.tabs() : [];
  if (page.uploadFiles) {
    const uploaded = await page.uploadFiles(selector, [image.path]);
    if (!uploaded?.uploaded || uploaded.files !== 1) throw new CommandExecutionError('Image upload was not acknowledged');
  } else await page.setFileInput([image.path], selector);
  if (site === '1688') {
    await page.wait(1);
    const submitted = await page.evaluate(`(() => {const preview=document.querySelector('[class*="previewList"] img'); const b=document.querySelector('button[class*="actionPrimary"]'); if(!preview||!b)return false; b.click();return true})()`);
    if (!submitted) throw new CommandExecutionError('1688 image preview/submit missing; no search submitted');
  }
  let lastError;
  for (let i=0;i<20;i++) {
    await page.wait(1);
    if (site === '1688' && page.tabs) {
      const tabs = await page.tabs();
      const tab = tabs.find(t => !before.some(b => b.page === t.page) && isImageResultUrl(site, t.url));
      if (tab) await page.selectTab(tab.page);
    }
    const state = await page.evaluate(`(() => ({href:location.href,title:document.title,text:(document.body?.innerText||'').slice(0,1500),loginFrame:!!document.querySelector('iframe[src*="login."], iframe[src*="passport"]')}))()`);
    assertSearchPage(state);
    if (!isImageResultUrl(site, state.href)) continue;
    try {
      const rows = await readRows(page, limit);
      return rows.map(row => ({...row, search_type:'image', query_image_sha256:image.sha256,
        query_image_bytes:image.bytes, query_image_mime:image.mime, identical_product_verified:false}));
    } catch (error) {
      // Retry only genuinely empty, still-loading result pages, never auth/DOM failures.
      if (!/No (?:Alibaba product|visible image result) cards/.test(error.message)) throw error;
      lastError = error;
    }
  }
  throw new CommandExecutionError('Image search did not produce verified result cards', lastError?.message || 'Upload/search may require login or the page layout changed. No keyword fallback was used.');
}
