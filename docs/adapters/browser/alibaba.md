# Alibaba.com

`opencli alibaba search "window privacy film" --limit 5 -f json`

Read-only visible product-card discovery. Uses the existing Browser Bridge; reads
product IDs, canonical item URLs, listing price text/range, explicitly indicated
currency, MOQ, supplier label and source/time provenance. Unknown fields are null.

The adapter has normalization and fake-page contract tests. Live authenticated
search has not been certified. A missing bridge, login/verification page or absent
cards is an error, not a successful zero-price result. DOM changes may require
selector updates. No contact, inquiries, purchases, image search, customs or
cross-platform exact-product matching are implemented.
