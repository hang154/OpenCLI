# Naver Shopping discovery

```sh
opencli naver-shopping search '창문 필름' --limit 5 -f json
```

Uses the existing Browser Bridge. Opens `https://www.naver.com/`, fills `#query`,
verifies that value and clicks `#search-btn`. It never directly navigates to a
constructed search-result URL. Reads product cards from the resulting unified
search's **shopping price-comparison section**, not the full Shopping tab.

The resulting URL must contain the submitted query. A missing shopping section,
login page or access restriction is a failure. Loading waits are bounded; restriction
pages stop immediately. Result count may be below `--limit` because only cards
actually present in that section are returned. No expansion/pagination is claimed.

Fields: Naver product ID, original product link (including observed redirect links),
title, displayed regular price in KRW, seller if shown, shipping fee if shown,
thumbnail, sponsored flag, raw price candidates, evidence text, source and timestamp.
Original prices marked `할인 전` and conditional coupon prices do not replace the
regular listing price. Missing prices/sellers/shipping remain unknown. Ads retain
`is_sponsored: true`; being displayed is not evidence of sales or popularity.
`search_surface` identifies the unified-search shopping section.

Images from Alibaba/1688 can be combined with **explicit Korean keyword search**
in the companion sourcing wrapper. No Naver image search, exact-SKU cross-platform
verification, option/size equivalence or profit calculation is claimed.

## Optional official API

```sh
opencli naver-shopping search-api '창문 필름' --limit 5 -f json
```

Reads `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET` from the process environment and
calls the [official Shopping Search API](https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md).
No browser is required. Missing credentials or non-200 responses fail explicitly;
no automatic fallback is performed. Keys must never be supplied in arguments,
reports or source files. API `lprice: 0` means unknown and is stored as null.

Validation on 2026-10-21: direct Shopping URL showed an access restriction. Main
homepage search-box entry exposed actual price-comparison cards, while clicking
the separate Shopping tab led to login. The integrated browser command collected
four products with price/shipping/ad provenance. Official API behavior has mocked
HTTP tests; live API execution is blocked by missing local credentials.
