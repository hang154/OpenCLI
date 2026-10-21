import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError } from '@jackwener/opencli/errors';
import { options,normalizeCandidates,assertAccessible } from './shared.js';
export const searchCommand=cli({
 site:'naver-shopping',name:'search',access:'read',domain:'www.naver.com',strategy:Strategy.COOKIE,navigateBefore:false,
 description:'Search through the Naver homepage search box; read its visible shopping price-comparison section',
 args:[{name:'query',required:true,positional:true,help:'Korean product keywords'},{name:'limit',type:'int',default:20,help:'Maximum visible results (1–100); not guaranteed'}],
 columns:['rank','product_id','title','price_min','shipping_fee','seller_name','is_sponsored','item_url'],
 func:async(page,args)=>{
  const {query,limit}=options(args);
  await page.goto('https://www.naver.com/');await page.wait(1);
  const filled=await page.fillText('#query',query);
  if(!filled?.verified)throw new CommandExecutionError('Naver homepage query could not be verified');
  await page.click('#search-btn');
  for(let i=0;i<12;i++){
   await page.wait(1);
   const data=await readShoppingSection(page);assertAccessible(data);
   let url;try{url=new URL(data.href);}catch{continue;}
   if(url.hostname!=='search.naver.com'||url.searchParams.get('query')?.trim()!==query)continue;
   if(data.cards?.length)return normalizeCandidates(data.cards,data.href,limit);
  }
  throw new CommandExecutionError('No Naver shopping section appeared','The homepage search was submitted; no direct search-result URL or keyword fallback was used.');
 }
});
export async function readShoppingSection(page){
 return page.evaluate(`(() => {
  const cards=[...document.querySelectorAll('[id^="view_type_guide_"]')].map(info=>{
   const root=info.closest('li')||info.parentElement;
   const links=[...info.querySelectorAll('a')];
   const title=links.find(a=>/\\.(?:itemtit|tit)$/.test(a.dataset.nlogArea||''));
   const seller=links.find(a=>/\\.mall$/.test(a.dataset.nlogArea||''));
   const prices=[...info.querySelectorAll('span')].filter(n=>/^[0-9,]+$/.test(n.textContent.trim())&&n.nextElementSibling?.textContent.trim()==='원')
     .map(n=>({amount:n.textContent.trim(),parent_tag:n.parentElement.tagName,
       context:(n.parentElement.innerText||'').slice(0,150),struck:!!n.closest('del,s')||getComputedStyle(n).textDecorationLine.includes('line-through')}));
   const text=root.innerText||'';
   const shipping=text.match(/배송비\\s*(무료|[\\d,]+원)/);
   return {product_id:info.id.replace('view_type_guide_',''),title:title?.innerText,item_url:title?.href,
     price_candidates:prices,seller_name:seller?.innerText||null,image_url:root.querySelector('img')?.src||null,
     shipping_text:shipping?.[0]||null,shipping_fee:shipping?(shipping[1]==='무료'?0:Number(shipping[1].replace(/[^0-9]/g,''))):null,
     is_sponsored:!!info.querySelector('[data-nlog-area$=".info"]')||links.some(a=>a.hostname==='ader.naver.com'),
     evidence_text:text.slice(0,1500)};
  });
  return {href:location.href,title:document.title,text:(document.body?.innerText||'').slice(0,1500),cards};
 })()`);
}
