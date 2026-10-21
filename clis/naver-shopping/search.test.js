import {describe,it,expect,vi,afterEach} from 'vitest';
import {normalizeCandidates,positivePrice} from './shared.js';
import {searchCommand} from './search.js';
import {apiCommand} from './search-api.js';
const source='https://search.naver.com/search.naver?query=창문+필름';
const card={product_id:'60325563982',title:'무점착 창문 필름',item_url:'https://cr3.shopping.naver.com/v2/bridge/searchGate?nv_mid=60325563982',price:'2,400',seller_name:'판매점',shipping_fee:3000};
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('Naver shopping normalization',()=>{
 it('retains the observed link, shipping and KRW without verifying SKU identity',()=>{
  const [r]=normalizeCandidates([card,card],source,5);expect(r.product_id).toBe(card.product_id);expect(r.price_min).toBe(2400);expect(r.shipping_fee).toBe(3000);expect(r.currency).toBe('KRW');expect(r.item_url).toBe(card.item_url);expect(r.identical_product_verified).toBe(false);
  expect(normalizeCandidates([card,card],source,5)).toHaveLength(1);
 });
 it('does not parse zero, booleans, missing or arbitrary text as prices',()=>{
  for(const value of [0,-1,null,undefined,NaN,Infinity,true,'0','2,400원','무료'])expect(positivePrice(value)).toBeNull();
  expect(normalizeCandidates([{...card,price:'0'}],source,5)[0].currency).toBeNull();
 });
 it('rejects spoofed hosts and product IDs',()=>{
  expect(()=>normalizeCandidates([card],source.replace('naver.com','naver.com.evil.test'),5)).toThrow('source');
  for(const change of [{product_id:'bad'},{item_url:'javascript:alert(1)'},{item_url:'https://naver.com.evil.test/item'}])expect(()=>normalizeCandidates([{...card,...change}],source,5)).toThrow('No Naver');
 });
});
describe('search-box navigation contract',()=>{
 const page=states=>({goto:vi.fn(),wait:vi.fn(),fillText:vi.fn().mockResolvedValue({verified:true}),click:vi.fn(),evaluate:vi.fn(async()=>states.length>1?states.shift():states[0])});
 const result={href:source,title:'창문 필름',text:'네이버 가격비교',cards:[card]};
 it('enters via the homepage query box, waits for the requested query and extracts the shopping section',async()=>{
  const p=page([{href:source.replace('창문+필름','다른검색'),cards:[card]},result]);
  const r=await searchCommand.func(p,{query:'창문 필름',limit:5});
  expect(p.goto.mock.calls).toEqual([['https://www.naver.com/']]);expect(p.fillText).toHaveBeenCalledWith('#query','창문 필름');expect(p.click).toHaveBeenCalledWith('#search-btn');expect(r).toHaveLength(1);expect(r[0].search_surface).toBe('unified_search_shopping_section');
 });
 it('stops immediately on access restrictions even when stale cards remain',async()=>{
  const p=page([{...result,text:'쇼핑 서비스 접속이 일시적으로 제한되었습니다.'}]);
  await expect(searchCommand.func(p,{query:'창문 필름'})).rejects.toThrow('restricted');expect(p.evaluate).toHaveBeenCalledTimes(1);
 });
 it('does not click search if filling failed verification',async()=>{
  const p=page([result]);p.fillText.mockResolvedValue({verified:false});await expect(searchCommand.func(p,{query:'창문 필름'})).rejects.toThrow('verified');expect(p.click).not.toHaveBeenCalled();
 });
 it('does not report success for missing shopping cards',async()=>{
  await expect(searchCommand.func(page([{...result,cards:[]}]),{query:'창문 필름'})).rejects.toThrow('No Naver shopping section');
 });
});
describe('official API contract (mock HTTP, no live certificate)',()=>{
 it('requires existing local credentials and never sends a request without them',async()=>{
  vi.stubEnv('NAVER_CLIENT_ID','');vi.stubEnv('NAVER_CLIENT_SECRET','');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  await expect(apiCommand.func(null,{query:'창문 필름'})).rejects.toThrow('NAVER_CLIENT');expect(fetch).not.toHaveBeenCalled();
 });
 it('uses the official endpoint and preserves unknown zero prices',async()=>{
  vi.stubEnv('NAVER_CLIENT_ID','test-id');vi.stubEnv('NAVER_CLIENT_SECRET','test-secret');
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({items:[{productId:'123',title:'<b>필름</b>',link:'https://shop.example/product/1',lprice:'0',hprice:'0',mallName:'매장'}]})});vi.stubGlobal('fetch',fetch);
  const r=await apiCommand.func(null,{query:'창문 필름',limit:5});expect(r[0].title).toBe('필름');expect(r[0].price_min).toBeNull();expect(r[0].strategy).toBe('official_api');expect(fetch.mock.calls[0][0].hostname).toBe('openapi.naver.com');expect(JSON.stringify(r)).not.toContain('test-secret');
 });
 it('does not report API HTTP failure as an empty result',async()=>{
  vi.stubEnv('NAVER_CLIENT_ID','test');vi.stubEnv('NAVER_CLIENT_SECRET','test');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:429}));
  await expect(apiCommand.func(null,{query:'필름'})).rejects.toThrow('HTTP 429');
 });
});

import {selectRegularPrice} from './shared.js';
it('chooses the current selling price rather than original or conditional coupon price',()=>{
 const prices=[{amount:'3,100',parent_tag:'DIV',context:'할인 전 판매가 3,100원'},
               {amount:'2,400',parent_tag:'DIV',context:'22%할인 2,400원'},
               {amount:'2,000',parent_tag:'SPAN',context:'쿠폰할인가 2,000원'}];
 expect(selectRegularPrice(prices)).toBe('2,400');
 expect(normalizeCandidates([{...card,price:'3100',price_candidates:prices}],source,5)[0].price_min).toBe(2400);
 expect(selectRegularPrice([prices[0],prices[2]])).toBeNull();
});
