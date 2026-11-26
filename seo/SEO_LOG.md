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
- Recommend: get RKD listed on karamel.co.il and tiuli.com (see playbook) — these sites currently occupy the exact SERP positions we want.
- Recommend: confirm Google Business Profile is complete, and start collecting Google reviews.
- Site content (pricing, pages) can change independently of SEO work — always re-check live content; don't assume last run's findings still hold.

## Addendum to Run 1 — same day, Search Console access added

The owner set up a Search Console service account mid-run (`seo-reader@rkd-seo.iam.gserviceaccount.com`, added as a Restricted user on the `sc-domain:rkdzichron.com` property). `seo/search_console_report.py` was built to query it directly — **this replaces the WebSearch baseline with real data going forward**, whenever the running session has the key (see playbook's "Search Console access" section). The WebSearch-based baseline above undersold the site significantly — real numbers tell a better story:

**Real baseline (Search Console, last 90 days, lags ~2-3 days):**
- The site already has impressions on exactly the kind of queries it's targeting: "אטרקציות בזכרון יעקב" (avg position **1.5**), "זכרון יעקב אטרקציות" (avg position **1.0**, 1 click), "arcade near me" (position 7.8, 30 impressions), brand query "rkd" (position 3.6, 47 impressions).
- The Hebrew pages are working: `he/` (homepage) got 295 impressions and 30 clicks (10.2% CTR — strong) in 90 days; `he/book.html` 98 impressions; `he/birthday.html` 93 impressions.
- Weak spot found: "מסיבת יום הולדת לילדים" (kids birthday party — a core target phrase) sits at avg position **11.6** (page 2), 5 impressions, 0 clicks. Worth targeting directly in a future run.
- New keyword opportunity found that isn't targeted anywhere on the site yet: "מכונות משחק לאירועים בזיכרון יעקב" (game machines for events in Zichron Yaakov) — 33 impressions, avg position 7.5. Maps well to the Group Rates / events page; consider adding this phrasing there in a future run.
- **Possible technical issue, needs the owner to check (not a code fix):** the homepage shows up as two separate entries in Search Console — `http://rkdzichron.com/` (594 impressions) and `https://rkdzichron.com/` (324 impressions) — suggesting plain HTTP may not be redirecting to HTTPS. This agent's sandboxed network couldn't confirm the live redirect behavior directly. **Action for the owner:** in the GitHub repo's Settings → Pages, confirm "Enforce HTTPS" is checked. If HTTP isn't redirecting, it's splitting ranking signals between two versions of the same page.
