import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseProductUrl, isVerificationPage, solvePunishSlider, detailCommand } from './detail.js';
import { getRegistry } from '@jackwener/opencli/registry';

const detailUrl = 'https://www.alibaba.com/product-detail/Winon-Bakelite-Prayer_1601729685403.html';
const punish = { url: detailUrl, title: 'Captcha Interception', text: '죄송합니다. 회원님의 네트워크에서 비정상적인 트래픽이 감지되었습니다 밀어서 확인하기', links: [] };
const good = { url: detailUrl, title: 'Winon Fashion Arabic Resin Bakelite Prayer Beads', text: 'Jewelry Main Material Resin', links: [] };

describe('Alibaba detail URL contract', () => {
  it('canonicalizes product URLs and extracts the listing id', () => {
    const r = parseProductUrl(detailUrl + '?spm=a2700.x#top');
    expect(r.product_id).toBe('1601729685403'); expect(r.url).toBe(detailUrl);
  });
  it('rejects non-product paths on foreign hosts', () => {
    expect(parseProductUrl('https://alibaba.com.evil.test/product-detail/X_1.html')).toBeNull();
    expect(parseProductUrl('https://www.alibaba.com/trade/search?SearchText=a')).toBeNull();
  });
});

describe('Punish detection and slider clearing', () => {
  it('detects the Korean punish page with the product URL unchanged', () => expect(isVerificationPage(punish)).toBe(true));
  it('accepts a genuine product page', () => expect(isVerificationPage(good)).toBe(false));
  it('dispatches a sliding pointer trajectory ending in one release', async () => {
    const calls = [];
    const page = { evaluate: async () => ({ x: 100, y: 200, end: 350 }), cdp: async (_m, p) => { calls.push(p); }, wait: async () => {} };
    expect(await solvePunishSlider(page)).toBe(true);
    expect(calls.filter(c => c.type === 'mousePressed')).toHaveLength(1);
    expect(calls.filter(c => c.type === 'mouseReleased')).toHaveLength(1);
    expect(calls.filter(c => c.type === 'mouseMoved' && c.buttons === 1).length).toBeGreaterThanOrEqual(10);
    expect(calls.at(-1).x).toBeGreaterThan(250);
  });
  it('reports inability to solve when the slider is absent', async () => {
    const page = { evaluate: async () => null, cdp: async () => ({}), wait: async () => {} };
    expect(await solvePunishSlider(page)).toBe(false);
  });
});

describe('Alibaba detail command flow (fake browser)', () => {
  const command = () => getRegistry().get('alibaba/detail');
  it('reads a reachable product page without the mirror', async () => {
    const page = { goto: async () => {}, wait: async () => {}, evaluate: async () => good, cdp: async () => ({}) };
    const r = await command().func(page, { url: detailUrl });
    expect(r.observed_via).toBe('browser'); expect(r.mirror).toBeNull();
  });
  it('falls back to the text mirror when the slider persists', async () => {
    const mirrorText = 'Title: Winon Prayer Beads\n' + 'x'.repeat(3000) + '\nproductId 1601729685403';
    globalThis.fetch = async () => ({ ok: true, text: async () => mirrorText });
    const page = { goto: async () => {}, wait: async () => {}, evaluate: async () => punish, cdp: async () => { throw new Error('no cdp'); } };
    const r = await command().func(page, { url: detailUrl });
    expect(r.observed_via).toBe('text_proxy'); expect(r.mirror.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.mirror.bytes).toBe(Buffer.byteLength(mirrorText));
  });
  it('does not fabricate success when the mirror returns another product', async () => {
    globalThis.fetch = async () => ({ ok: true, text: async () => 'unrelated content here '.repeat(200) });
    const page = { goto: async () => {}, wait: async () => {}, evaluate: async () => punish, cdp: async () => { throw new Error('no cdp'); } };
    await expect(command().func(page, { url: detailUrl })).rejects.toThrow('did not return this product');
  });
  it('retries the punish slider and reports browser_after_slider once cleared', async () => {
    let reads = 0;
    const page = { goto: async () => {}, wait: async () => {}, cdp: async () => ({}),
      evaluate: async js => (js.includes('nc_1_n1z') ? { x: 100, y: 200, end: 350 } : (++reads === 1 ? punish : good)) };
    const r = await command().func(page, { url: detailUrl });
    expect(r.observed_via).toBe('browser_after_slider'); expect(r.verification_cleared).toBe(true);
  });
  it('is registered as a read command with honest columns', () => {
    expect(command().access).toBe('read');
    expect(command().columns).toEqual(expect.arrayContaining(['observed_via', 'verification_cleared']));
    expect(readFileSync(new URL('./detail.js', import.meta.url), 'utf8')).toContain('r.jina.ai');
  });
});
