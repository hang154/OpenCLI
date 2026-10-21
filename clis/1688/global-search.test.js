import {describe,it,expect,vi} from 'vitest';
import {normalizeGlobalCard,uploadedImageId,globalImageUrl,globalImageSearch} from './global-search.js';
describe('1688 global research adapter',()=>{
 it('keeps MOQ out of the KRW price range and preserves original evidence',()=>{
  const row=normalizeGlobalCard({product_id:'123',title:'Bottle',price_text:'₩\n1,002\nMOQ:60',evidence_text:'raw'},'https://air.1688.com/',1);
  expect(row.price_min).toBe(1002);expect(row.price_max).toBe(1002);expect(row.moq_value).toBe(60);expect(row.currency).toBe('KRW');
  expect(row.identical_product_verified).toBe(false);expect(row.evidence_text).toBe('raw');
 });
 it('rejects fake identities and unknown currency amounts',()=>{
  expect(normalizeGlobalCard({product_id:'bad',title:'x'},'',1)).toBe(null);
  expect(normalizeGlobalCard({product_id:'123',title:'x',price_text:'MOQ:1'},'',1).price_min).toBe(null);
 });
 it('uses only successful official upload responses',()=>{
  const e={url:'https://h5api.m.1688.com/h5/mtop.cbu.global.marketing.search.image.upload/1.0/',responseStatus:200,responsePreview:JSON.stringify({ret:['SUCCESS::ok'],data:{data:{imageId:'1592008867621762165'}}})};
  expect(uploadedImageId(e)).toBe('1592008867621762165');
  expect(uploadedImageId({...e,responseStatus:403})).toBe(null);
  expect(uploadedImageId({...e,responsePreview:'broken'})).toBe(null);
  expect(()=>globalImageUrl('undefined')).toThrow();
 });
 it('does not accept old upload IDs or homepage recommendations',async()=>{
  const page={startNetworkCapture:vi.fn().mockResolvedValue(true),readNetworkCapture:vi.fn().mockResolvedValue([{timestamp:1}]),evaluate:vi.fn(),uploadFiles:vi.fn().mockResolvedValue({uploaded:true,files:1}),wait:vi.fn(),goto:vi.fn()};
  await expect(globalImageSearch(page,{path:'local.png'},3)).rejects.toThrow('fresh successful image ID');
  expect(page.goto).not.toHaveBeenCalled();
 });
});
