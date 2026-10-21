import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';

export function normalizeCandidate(card, sourceUrl, rank) {
  let url;
  try { url = new URL(card.href, sourceUrl); } catch { return null; }
  if (url.protocol !== 'https:' || !(url.hostname === 'alibaba.com' || url.hostname.endsWith('.alibaba.com'))) return null;
  const id = url.pathname.match(/^\/product-detail\/.+_(\d+)\.html$/)?.[1];
  if (!id) return null;
  url.search = ''; url.hash = '';
  const clean = x => String(x || '').replace(/\s+/g, ' ').trim();
  const priceText = clean(card.price_text);
  const values = priceText.match(/\d+(?:,\d{3})*(?:\.\d+)?/g)?.map(x => Number(x.replaceAll(',', ''))) || [];
  const currency = /US\s*\$|USD/i.test(priceText) ? 'USD' : /CNY|RMB|¥/.test(priceText) ? 'CNY' : null;
  const moqText = clean(card.moq_text);
  return { rank, product_id: id, title: clean(card.title) || null, item_url: url.href,
    price_text: priceText || null, price_min: values[0] > 0 ? values[0] : null,
    price_max: values[0] > 0 ? values[1] || values[0] : null, currency,
    moq_text: moqText || null, moq_value: Number(moqText.replaceAll(',', '').match(/\d+(?:\.\d+)?/)?.[0]) || null,
    seller_name: clean(card.seller_name) || null, image_url: card.image_url || null,
    source_url: sourceUrl, fetched_at: new Date().toISOString(), strategy: 'visible_dom',
    price_scope: 'listing_only_not_landed_cost', identical_product_verified: false };
}
export function normalizeCandidates(cards, sourceUrl, limit) {
  const rows = [], seen = new Set();
  for (const card of cards) {
    const row = normalizeCandidate(card, sourceUrl, rows.length + 1);
    if (row && !seen.has(row.product_id)) { seen.add(row.product_id); rows.push(row); }
    if (rows.length >= limit) break;
  }
  return rows;
}
cli({
  site: 'alibaba', name: 'search', access: 'read', domain: 'alibaba.com',
  description: 'Read Alibaba.com visible product search cards; no supplier contact or orders',
  strategy: Strategy.COOKIE, navigateBefore: false,
  args: [{ name: 'query', required: true, positional: true, help: 'Product search keywords' },
    { name: 'limit', type: 'int', default: 20, help: 'Results to return (1–100)' }],
  columns: ['rank', 'product_id', 'title', 'price_text', 'moq_text', 'seller_name', 'item_url'],
  func: async (page, args) => {
    const query = String(args.query || '').trim(), limit = Number(args.limit ?? 20);
    if (!query || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new ArgumentError('Use nonempty query and limit 1–100');
    const search = 'https://www.alibaba.com/trade/search?SearchText=' + encodeURIComponent(query);
    await page.goto(search); await page.wait(2.5);
    const data = await page.evaluate(`(() => {
      const text = document.body?.innerText || '';
      const cards = [...document.querySelectorAll('a[href*="/product-detail/"]')].map(a => {
        const root = a.closest('[class*="search-card"], [class*="organic-list-offer"], [class*="product-card"]') || a.parentElement;
        const get = s => root?.querySelector(s)?.textContent?.trim() || '';
        return {href:a.href,title:a.getAttribute('title') || a.querySelector('img')?.alt || a.textContent?.trim(),
          price_text:get('[class*="price"]'),moq_text:get('[class*="moq"], [class*="min-order"]'),
          seller_name:get('[class*="company-name"], [class*="supplier-name"]'),image_url:root?.querySelector('img')?.src || null};
      });
      return {href:location.href,title:document.title,text:text.slice(0,1200),cards};
    })()`);
    if (/captcha|punish|_____tmd_____|login\.alibaba|passport/i.test(data.href) || /verify (?:you are|your identity)|slide to verify|验证码|滑动验证/i.test(data.text + data.title))
      throw new CommandExecutionError('Alibaba returned a login/verification page', 'Complete verification in the existing browser, then retry.');
    const rows = normalizeCandidates(data.cards || [], data.href, limit);
    if (!rows.length) throw new CommandExecutionError('No Alibaba product cards observed', 'Check the visible browser page; this is not a successful empty price result.');
    return rows;
  },
});
