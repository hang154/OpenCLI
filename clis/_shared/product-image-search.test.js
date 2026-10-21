import {describe,it,expect,vi,afterAll} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateImage,isImageResultUrl,searchByImage} from './product-image-search.js';
const dir=mkdtempSync(join(tmpdir(),'opencli-image-'));
const image=join(dir,'product.png');
writeFileSync(image,Buffer.from('89504e470d0a1a0a0000000d49484452','hex'));
afterAll(()=>rmSync(dir,{recursive:true,force:true}));
const resultUrl='https://www.alibaba.com/search/page?SearchScene=imageTextSearch&imagePath=https%3A%2F%2Fexample.com%2Fquery.png';
function browser(states=[{href:resultUrl,title:'Products',text:''}]) {
 const queue=[true,...states];
 return {goto:vi.fn(),wait:vi.fn(),tabs:vi.fn().mockResolvedValue([]),uploadFiles:vi.fn().mockResolvedValue({uploaded:true,files:1}),
   evaluate:vi.fn(async()=>queue.length>1?queue.shift():queue[0]),getCookies:vi.fn().mockResolvedValue([])};
}
describe('official product image search',()=>{
 it('hashes the exact supplied image without including its bytes',()=>{
  const a=validateImage(image);expect(a.sha256).toMatch(/^[a-f0-9]{64}$/);expect(a.mime).toBe('image/png');
 });
 it('rejects missing files and renamed text before visiting a website',async()=>{
  const bad=join(dir,'bad.jpg');writeFileSync(bad,'not an image');const page=browser();
  await expect(searchByImage(page,{image:bad},'alibaba',vi.fn())).rejects.toThrow('signature');expect(page.goto).not.toHaveBeenCalled();
  expect(()=>validateImage(join(dir,'missing.jpg'))).toThrow('regular file');
 });
 it('rejects oversized input',()=>{
  const big=join(dir,'big.jpg');writeFileSync(big,Buffer.alloc(10*1024*1024+1));expect(()=>validateImage(big)).toThrow('10 MiB');
 });
 it('accepts only image-result URLs on the exact marketplace host',()=>{
  expect(isImageResultUrl('alibaba',resultUrl)).toBe(true);
  for(const url of ['https://www.alibaba.com/',resultUrl.replace('alibaba.com','alibaba.com.evil.test'),resultUrl.replace('imageTextSearch','keyword')])expect(isImageResultUrl('alibaba',url)).toBe(false);
  expect(isImageResultUrl('1688','https://s.1688.com/youyuan/index.htm?tab=imageSearch&imageAddress=https%3A%2F%2Fx.test%2Fa.jpg')).toBe(true);
 });
 it('uploads one image and preserves query provenance on each candidate',async()=>{
  const page=browser(),read=vi.fn().mockResolvedValue([{item_url:'https://www.alibaba.com/product-detail/X_123.html'}]);
  const rows=await searchByImage(page,{image,limit:3},'alibaba',read);
  expect(page.uploadFiles).toHaveBeenCalledWith('input[type="file"][name="image-search-upload"]',[image]);
  expect(rows[0].query_image_sha256).toBe(validateImage(image).sha256);expect(rows[0].identical_product_verified).toBe(false);expect(read).toHaveBeenCalledWith(page,3);
 });
 it('does not accept homepage recommendations when upload fails to navigate',async()=>{
  const read=vi.fn(),page=browser([{href:'https://www.alibaba.com/',text:'Recommended products',title:''}]);
  await expect(searchByImage(page,{image},'alibaba',read)).rejects.toThrow('verified result cards');expect(read).not.toHaveBeenCalled();
 });
 it('stops on challenge pages and failed upload acknowledgement',async()=>{
  await expect(searchByImage(browser([{href:resultUrl,text:'Slide to verify',title:''}]),{image},'alibaba',vi.fn())).rejects.toThrow('login/verification');
  const page=browser();page.uploadFiles.mockResolvedValue({uploaded:false,files:0});
  await expect(searchByImage(page,{image},'alibaba',vi.fn())).rejects.toThrow('not acknowledged');
 });
 it('rejects anonymous 1688 without uploading',async()=>{
  const page=browser();await expect(searchByImage(page,{image},'1688',vi.fn())).rejects.toThrow('Sign in');expect(page.uploadFiles).not.toHaveBeenCalled();
 });
 it('waits for still-loading cards, but never retries other parser failures',async()=>{
  const read=vi.fn().mockRejectedValueOnce(new Error('No Alibaba product cards observed')).mockResolvedValue([{title:'Ready'}]);
  expect(await searchByImage(browser(),{image},'alibaba',read)).toHaveLength(1);expect(read).toHaveBeenCalledTimes(2);
  const bad=vi.fn().mockRejectedValue(new Error('Unexpected response'));
  await expect(searchByImage(browser(),{image},'alibaba',bad)).rejects.toThrow('Unexpected response');expect(bad).toHaveBeenCalledTimes(1);
 });
});

import {imageSearchCommand as alibabaCommand} from '../alibaba/image-search.js';
import {imageSearchCommand as cnCommand} from '../1688/image-search.js';
import {searchCommand as keywordAlibaba} from '../alibaba/search.js';
import {searchCommand as keyword1688} from '../1688/search.js';
it('exports distinct commands so manifest generation preserves keyword command ownership',()=>{
 expect(alibabaCommand.name).toBe('image-search');expect(cnCommand.name).toBe('image-search');
 expect(keywordAlibaba.name).toBe('search');expect(keyword1688.name).toBe('search');
});
it('submits the 1688 preview and follows a newly opened image-result tab only',async()=>{
 const page=browser(),url='https://s.1688.com/youyuan/index.htm?tab=imageSearch';
 page.getCookies.mockResolvedValue([{name:'__cn_logon__',value:'true'}]);
 page.tabs.mockResolvedValueOnce([{page:'old',url:'https://www.1688.com/'}]).mockResolvedValue([{page:'old',url:'https://www.1688.com/'},{page:'result',url}]);
 page.selectTab=vi.fn();page.evaluate.mockResolvedValueOnce(true).mockResolvedValue({href:url,title:'Products',text:''});
 const rows=await searchByImage(page,{image},'1688',async()=>[{offer_id:'123'}]);
 expect(rows[0].search_type).toBe('image');expect(page.selectTab).toHaveBeenCalledWith('result');
 expect(page.uploadFiles).toHaveBeenCalledWith('input[type="file"][aria-label="以图搜款"]',[image]);
});
