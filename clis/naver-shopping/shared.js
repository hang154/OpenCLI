import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';
export function options(args) {
  const query=String(args.query||'').trim(),limit=Number(args.limit??20);
  if(!query||!Number.isInteger(limit)||limit<1||limit>100)throw new ArgumentError('Use nonempty query and limit 1–100');
  return {query,limit};
}
export function positivePrice(value) {
  const text=String(value??'').replaceAll(',','').trim();
  if(!/^\d+(?:\.\d+)?$/.test(text))return null;
  const number=Number(text);return Number.isFinite(number)&&number>0?number:null;
}
export function selectRegularPrice(candidates) {
  return candidates.find(x=>x.parent_tag==='DIV'&&!x.struck&&!/할인 전|쿠폰할인가/.test(x.context||'')&&positivePrice(x.amount)!==null)?.amount??null;
}
export function normalizeCandidates(cards,sourceUrl,limit,strategy='visible_dom') {
  const source=new URL(sourceUrl),rows=[],seen=new Set();
  if(source.protocol!=='https:'||!['search.naver.com','search.shopping.naver.com','openapi.naver.com'].includes(source.hostname))throw new CommandExecutionError('Invalid Naver search source');
  for(const card of cards) {
    const id=String(card.product_id??'');if(!/^\d+$/.test(id)||seen.has(id))continue;
    let url;try{url=new URL(card.item_url);}catch{continue;}
    if(url.protocol!=='https:')continue;
    if(strategy!=='official_api'&&!(url.hostname==='naver.com'||url.hostname.endsWith('.naver.com')))continue;
    const title=String(card.title||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();if(!title)continue;
    seen.add(id);const price=positivePrice(Array.isArray(card.price_candidates)?selectRegularPrice(card.price_candidates):card.price);
    rows.push({rank:rows.length+1,product_id:id,title,item_url:url.href,
      price_min:price,price_max:positivePrice(card.price_max)||price,currency:price===null?null:'KRW',
      price_text:card.price_text|| (price===null?null:price+'원'),
      seller_name:card.seller_name||null,image_url:card.image_url||null,
      shipping_fee:card.shipping_fee??null,shipping_text:card.shipping_text||null,
      price_candidates:card.price_candidates||null,
      is_sponsored:card.is_sponsored??null,source_url:sourceUrl,fetched_at:new Date().toISOString(),
      strategy,search_type:'keyword',search_surface:strategy==='official_api'?'official_shopping_api':'unified_search_shopping_section',
      price_scope:'displayed_listing_shipping_not_included',identical_product_verified:false,
      raw_listing:card});
    if(rows.length>=limit)break;
  }
  if(!rows.length)throw new CommandExecutionError('No Naver shopping product cards observed','This is not a successful empty result.');
  return rows;
}
export function assertAccessible(data) {
  if(/접속.{0,15}(?:제한|차단)|비정상적인 접근|자동입력 방지|보안 확인|captcha/i.test(data.title+' '+data.text)
    ||/nid\.naver\.com/.test(data.href))throw new CommandExecutionError('Naver access restricted or login required','Complete the existing browser login/diagnosis before retrying; no automatic request loop.');
}
