# Alibaba.com

`opencli alibaba search "window privacy film" --limit 5 -f json`

Read-only visible product-card discovery. Uses the existing Browser Bridge; reads
product IDs, canonical item URLs, listing price text/range, explicitly indicated
currency, MOQ, supplier label and source/time provenance. Unknown fields are null.

The adapter has normalization and fake-page contract tests. Live authenticated
search has not been certified. A missing bridge, login/verification page or absent
cards is an error, not a successful zero-price result. DOM changes may require
selector updates. No contact, inquiries, purchases, customs or cross-platform exact-product matching
are implemented. Image-search coverage is described below.

## Product detail with access-limit breakout

```sh
opencli alibaba detail "https://www.alibaba.com/product-detail/<slug>_<id>.html" -f json
```

Reads one product page through a three-step ladder so a baxia punish page
("밀어서 확인하기") does not end the run: (1) direct load in the connected session;
(2) if punished, one human-like CDP pointer trajectory (26 eased steps, single
release) clears the slide-to-verify widget, then the page is reloaded once;
(3) if still punished, the page text is fetched through the `r.jina.ai` text
mirror, accepted only when it contains the requested product ID, and stored with
`observed_via: text_proxy` plus mirror URL, byte count and SHA-256. A mirror that
returns another product is an error, never a silent success. The response keeps
`observed_via` (`browser`, `browser_after_slider` or `text_proxy`),
`verification_cleared` and `slider_attempts` so downstream reports can distinguish
provenance. `--save-mirror-to <path>` retains raw mirror text for evidence.

Live validation (2026-10-21): three previously CAPTCHA-blocked product pages and
their supplier profiles were read with `observed_via: browser` after the block
lapsed; the ladder is contract-tested in `clis/alibaba/detail.test.js`, including
punish detection and the dispatch sequence. Sustained punishment still routes
through the slider, and a blocked mirror stays a recorded failure.

## Reverse image search

```sh
opencli alibaba image-search /absolute/path/product.jpg --limit 5 -f json
opencli 1688 image-search /absolute/path/product.jpg --limit 5 -f json
```

Uploads exactly the supplied local photo to the marketplace's official image-search
UI using the connected Browser Bridge. JPEG, PNG, BMP and WebP signatures and
extensions are checked; input size is capped at 10 MiB. No paid image-search or
Alibaba AI API is used. Image search does not fall back to keyword search.

Each candidate retains `search_type: image`, `query_image_sha256`, image size/MIME,
result-page URL and observation time. Similarity rank is the site's ordering;
`identical_product_verified` remains false. A result is accepted only on a recognized
image-search result URL with visible product cards. Homepage recommendations,
challenge pages and unacknowledged uploads are failures. Korean displayed prices
retain explicit KRW currency; shipping/taxes are still excluded.

Live validation (2026-10-21): a public Alibaba listing photo returned five candidates,
including its original product ID, with price/currency/MOQ/supplier evidence.
1688's upload and preview controls were inspected; automated end-to-end extraction
remains blocked by missing browser login. Signed-in 1688 selectors/navigation have
contract tests, not a live success certificate. DOM changes may require updates.
