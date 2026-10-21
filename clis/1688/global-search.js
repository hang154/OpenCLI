import {ArgumentError, CommandExecutionError} from '@jackwener/opencli/errors';
export const GLOBAL_SEARCH = 'https://air.1688.com/kapp/1688-global/sales/search';

export function globalImageUrl(imageId) {
  if (!/^\d{10,30}$/.test(String(imageId))) throw new ArgumentError('Invalid uploaded 1688 image ID');
  return `${GLOBAL_SEARCH}?tab=imageSearch&imageId=${imageId}&imageIdList=${imageId}`;
}

export function normalizeGlobalCard(card, source, rank) {
  const id = String(card.product_id || '');
  if (!/^\d+$/.test(id) || !card.title) return null;
  const p = String(card.price_text || '').match(/([₩¥￥$])\s*([\d,]+(?:\.\d+)?)(?:\s*[-~]\s*([\d,]+(?:\.\d+)?))?/);
  const price = p ? Number(p[2].replaceAll(',', '')) : null;
  const max = p ? Number((p[3] || p[2]).replaceAll(',', '')) : null;
  const moq = String(card.price_text || '').match(/MOQ\s*:\s*(\d+)/i);
  return {rank, offer_id:id, product_id:id, title:card.title,
    item_url:`https://detail.1688.com/offer/${id}.html`, image_url:card.image_url || null,
    price_text:p?.[0] || null, price_min:price > 0 ? price : null, price_max:price > 0 ? max : null,
    currency:p ? ({'₩':'KRW','¥':'CNY','￥':'CNY','$':'USD'})[p[1]] : null,
    moq_text:moq?.[0] || null, moq_value:moq ? Number(moq[1]) : null,
    seller_name:card.seller_name || null, source_url:source, fetched_at:new Date().toISOString(),
    strategy:'visible_global_dom', price_scope:'representative_variant_not_landed_cost',
    evidence_text:card.evidence_text || null, identical_product_verified:false};
}

export async function readGlobalRows(page, limit) {
  const state = await page.evaluate(`(() => ({href:location.href,title:document.title,
    text:(document.body?.innerText||'').slice(0,1200),
    cards:[...document.querySelectorAll('.cgf-sale-product-list-card-wrapper[data-offerid]')].slice(0,${Number(limit)}).map(e=>({
      product_id:e.getAttribute('data-offerid'),title:e.querySelector('.cgf-card-title')?.innerText,
      price_text:e.querySelector('.cgf-card-price')?.innerText,
      image_url:e.querySelector('img')?.src,
      seller_name:e.querySelector('.cgf-card-company-name, .cgf-card-supplier-name')?.innerText,
      evidence_text:e.innerText}))}))()`);
  if (/captcha|punish|login\.|passport/i.test(state.href) || /slide to verify|验证码|滑动验证/i.test(state.title+state.text))
    throw new CommandExecutionError('1688 returned login/verification; complete it in the connected browser');
  const u = new URL(state.href);
  if (u.origin !== 'https://air.1688.com' || u.pathname !== '/kapp/1688-global/sales/search')
    throw new CommandExecutionError('Not a verified 1688 global search page');
  const rows = [], seen = new Set();
  for (const card of state.cards || []) {
    const row = normalizeGlobalCard(card, state.href, rows.length+1);
    if (row && !seen.has(row.offer_id)) { seen.add(row.offer_id); rows.push(row); }
  }
  if (!rows.length) throw new CommandExecutionError('No visible image result cards on 1688 global search');
  return rows;
}

export async function globalKeywordSearch(page, query, limit) {
  if (!String(query).trim()) throw new ArgumentError('1688 query cannot be empty');
  await page.goto(`${GLOBAL_SEARCH}?keywords=${encodeURIComponent(String(query).trim())}&charset=utf8`);
  let last;
  for(let i=0;i<8;i++) {
    await page.wait(1);
    try { return await readGlobalRows(page, limit); }
    catch(e) { if(!/No visible image result cards/.test(e.message)) throw e; last=e; }
  }
  throw last;
}

export function uploadedImageId(entry) {
  if (!entry?.url?.includes('/mtop.cbu.global.marketing.search.image.upload/') || entry.responseStatus !== 200) return null;
  try {if (new URL(entry.url).hostname !== 'h5api.m.1688.com') return null;} catch {return null;}
  let body;
  try {body=typeof entry.responsePreview === 'string' ? JSON.parse(entry.responsePreview) : entry.responsePreview;} catch {return null;}
  const id=body?.data?.data?.imageId;
  return Array.isArray(body?.ret) && body.ret.some(v=>typeof v==='string' && v.startsWith('SUCCESS::')) && /^\d{10,30}$/.test(String(id)) ? String(id) : null;
}

export async function globalImageSearch(page, image, limit) {
  if (!page.startNetworkCapture || !page.readNetworkCapture || !await page.startNetworkCapture('mtop.cbu.global.marketing.search.image.upload'))
    throw new CommandExecutionError('1688 global image search requires browser upload-response capture');
  const since = Date.now();
  await page.evaluate(`(() => {document.querySelector('button[data-tracker="imgPanelOpen.search"]')?.click();return true})()`);
  const uploaded = await page.uploadFiles('input.beacon-upload-input', [image.path]);
  if (!uploaded?.uploaded || uploaded.files !== 1) throw new CommandExecutionError('Image upload was not acknowledged');
  let imageId;
  for(let i=0;i<25 && !imageId;i++) {
    await page.wait(1);
    const entries = await page.readNetworkCapture({retainIncomplete:true});
    imageId = entries.filter(e=>Number(e.timestamp)>=since).map(uploadedImageId).find(Boolean);
  }
  if (!imageId) throw new CommandExecutionError('1688 upload did not return a fresh successful image ID');
  // Same public result route used by the official homepage, using the actual upload response.
  await page.goto(globalImageUrl(imageId));
  let last;
  for(let i=0;i<10;i++) {
    await page.wait(1);
    try {return (await readGlobalRows(page, limit)).map(r=>({...r,query_image_id:imageId,
      search_type:'image',query_image_sha256:image.sha256,query_image_bytes:image.bytes,
      query_image_mime:image.mime, relevance_status:'unreviewed_image_candidate'}));}
    catch(e) {if(!/No visible image result cards/.test(e.message))throw e;last=e;}
  }
  throw last;
}
