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
