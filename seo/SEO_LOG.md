# SEO agent run log

See `seo/AGENT_PLAYBOOK.md` for the process this follows.

## Run 1 — 2026-11-26

**Baseline search check:**
- "things to do with kids in Zichron Yaakov" — not visible. Results dominated by Expedia/Hotels.com/Wanderlog travel-guide listings (Ramat Hanadiv, Kfar Hadayag, Carmel Winery, pedestrian mall) — none are an arcade.
- "kids birthday party Zichron Yaakov" — not visible. No Zichron-specific results at all; generic Israel-wide party directories (karamel.co.il, easy.co.il) surfaced instead.
- "אטרקציות למשפחה או ילדים זכרון יעקב" — not visible. karamel.co.il's own Zichron Yaakov attractions pages dominate this query directly.
- "RKD ארקייד זכרון יעקב" (brand check) — not visible, even for the brand name itself. Only generic Zichron Yaakov town results came back.

(Caveat: checked via WebSearch, not Google directly — see playbook. Not authoritative, but a consistent "not showing up yet" signal across all 4 queries is a meaningful baseline regardless.)

**Technical audit findings:**
- Repo had moved on significantly since the last SEO work (3.5 months): a new online booking flow was added (`book.html` / `he/book.html`, Apps Script + payment webhook, updated birthday pricing). The new booking pages had full title/meta/canonical/hreflang already — but were **missing the `LocalBusiness` JSON-LD** every other page has.
- `photos.html` / `he/photos.html` still referenced two photos (`photo5.jpg`, `photo6.jpg`) that don't exist in `images/`, silently hiding 2 of 6 gallery tiles.
- Several images were far larger than needed for how they're displayed: `photo1/2/_3.jpg` were full 2048×1536 originals (450–560KB each) shown in a gallery grid at a few hundred px, and `rkd_birthright.png` was a 1.9MB PNG for a photographic image that should be a JPEG.

**Fixes made:**
- Added `LocalBusiness` JSON-LD (with the Basic/VIP party `Offer`s) to `book.html` and `he/book.html`, matching the pattern on every other page.
- Removed the two broken gallery tiles from `photos.html` and `he/photos.html`.
- Compressed `photo1.jpg` (535KB→219KB), `photo2.jpg` (447KB→190KB), `photo_3.jpg` (560KB→228KB); converted `rkd_birthright.png` to a resized JPEG (1.9MB→262KB) and updated its two references in `group-rates.html`/`he/group-rates.html`.
- Added this playbook + log so the process repeats consistently.

**Still open / needs owner action:**
- No Search Console API access yet — next run should still use the WebSearch baseline unless that changes.
- Recommend: get RKD listed on karamel.co.il and tiuli.com (see playbook) — these sites currently occupy the exact SERP positions we want.
- Recommend: confirm Google Business Profile is complete, and start collecting Google reviews.
- Site content (pricing, pages) can change independently of SEO work — always re-check live content; don't assume last run's findings still hold.
