import { describe, it, expect } from 'vitest';
import { normalizeCandidate, normalizeCandidates } from './search.js';
const source = 'https://www.alibaba.com/trade/search?SearchText=window+film';
const card = {href:'https://www.alibaba.com/product-detail/Test-film_1601234567890.html?spm=test',title:' Window film ',price_text:'US$1.20 - US$1.80',moq_text:'100 pieces (Min. order)'};
describe('Alibaba visible listing normalization', () => {
  it('retains listing evidence and canonical product identity', () => {
    const r=normalizeCandidate(card,source,1);
    expect(r.product_id).toBe('1601234567890');expect(r.item_url).not.toContain('?');
    expect(r.price_min).toBe(1.2);expect(r.price_max).toBe(1.8);expect(r.currency).toBe('USD');expect(r.moq_value).toBe(100);expect(r.identical_product_verified).toBe(false);
  });
  it('does not invent missing price, currency or MOQ', () => {
    const r=normalizeCandidate({href:card.href},source,1);expect(r.price_min).toBeNull();expect(r.currency).toBeNull();expect(r.moq_value).toBeNull();
  });
  it('deduplicates listing variants', () => expect(normalizeCandidates([card,card],source,20)).toHaveLength(1));
  it('rejects spoofed hosts, nonproducts and insecure URLs', () => {
    for(const href of ['https://alibaba.com.evil.test/product-detail/X_1.html','https://www.alibaba.com/login','http://www.alibaba.com/product-detail/X_1.html'])expect(normalizeCandidate({href},source,1)).toBeNull();
  });
  it('does not treat dollar symbol as a verified currency',()=>expect(normalizeCandidate({...card,price_text:'$1.20'},source,1).currency).toBeNull());
});

import { getRegistry } from '@jackwener/opencli/registry';
describe('Alibaba adapter page contract (fake browser, not a live website)',()=>{
  const command=()=>getRegistry().get('alibaba/search');
  const page=data=>({goto:async()=>{},wait:async()=>{},evaluate:async()=>data});
  it('runs the command and returns normalized visible rows',async()=>{
    const rows=await command().func(page({href:source,title:'Search',text:'Products',cards:[card]}),{query:'window film',limit:5});
    expect(rows).toHaveLength(1);expect(rows[0].product_id).toBe('1601234567890');
  });
  it('rejects challenge pages even if stale product links exist',async()=>{
    await expect(command().func(page({href:source,title:'Verify you are human',text:'Slide to verify',cards:[card]}),{query:'window film',limit:5})).rejects.toThrow('verification');
  });
  it('does not report success when cards are absent',async()=>{
    await expect(command().func(page({href:source,title:'Search',text:'',cards:[]}),{query:'window film',limit:5})).rejects.toThrow('No Alibaba product cards');
  });
});
