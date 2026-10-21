import { cli } from '@jackwener/opencli/registry';
import { AuthRequiredError,CommandExecutionError } from '@jackwener/opencli/errors';
import { options,normalizeCandidates } from './shared.js';
export const apiCommand=cli({
 site:'naver-shopping',name:'search-api',access:'read',browser:false,
 description:'Search Naver Shopping official API using existing NAVER_CLIENT_ID/NAVER_CLIENT_SECRET environment variables',
 args:[{name:'query',required:true,positional:true,help:'Korean product keywords'},{name:'limit',type:'int',default:20,help:'Results (1–100)'}],
 columns:['rank','product_id','title','price_min','seller_name','item_url'],
 func:async(args)=>{
  const {query,limit}=options(args),id=process.env.NAVER_CLIENT_ID,secret=process.env.NAVER_CLIENT_SECRET;
  if(!id||!secret)throw new AuthRequiredError('Naver Shopping API','Configure existing NAVER_CLIENT_ID and NAVER_CLIENT_SECRET locally; never put them in commands or reports.');
  const url=new URL('https://openapi.naver.com/v1/search/shop.json');url.search=new URLSearchParams({query,display:String(limit),sort:'sim'}).toString();
  const response=await fetch(url,{headers:{'X-Naver-Client-Id':id,'X-Naver-Client-Secret':secret},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new CommandExecutionError('Naver Shopping API HTTP '+response.status);
  const body=await response.json();if(!Array.isArray(body.items))throw new CommandExecutionError('Naver Shopping API items missing');
  return normalizeCandidates(body.items.map(x=>({product_id:x.productId,title:x.title,item_url:x.link,price:x.lprice,price_max:x.hprice,seller_name:x.mallName,image_url:x.image,api_item:x})),url.href,limit,'official_api');
 }
});
