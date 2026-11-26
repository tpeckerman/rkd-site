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
- **Possible technical issue, needs the owner to check (not a code fix):** the homepage shows up as two separate entries in Search Console — `http://rkdzichron.com/` (594 impressions) and `https://rkdzichron.com/` (324 impressions) — suggesting plain HTTP may not be redirecting to HTTPS. This agent's sandboxed network couldn't confirm the live redirect behavior directly (the proxy only tunnels HTTPS). The owner confirmed "Enforce HTTPS" on GitHub Pages was on from the start, never toggled — so this is likely just old data from the 90-day lookback window (e.g. from before the SSL certificate finished provisioning when the custom domain was first set up) rather than a live, ongoing issue. Still unconfirmed with certainty — if a future run's Search Console data keeps showing a growing `http://` count rather than it fading out, that would mean it's a live problem after all and worth a harder look.

## Addendum 2 to Run 1 — same day, Doppler closes the automation gap

The owner set up a Doppler vault (project `rkd-seo`, config `prd`) holding the Google service-account key, and granted this session read access via a service token saved through `request_credential` for `api.doppler.com`. `seo/search_console_report.py` now fetches the key from Doppler automatically instead of needing it pasted into a session — **tested working with no local key file present**. This closes the gap flagged above and in the playbook's old "Known gaps" section: the unattended weekly job can now pull real Search Console data every run instead of falling back to WebSearch. See the playbook's "Search Console access" section for how this is wired up.

## Run 2 — 2026-11-26

**Baseline search check (real Search Console data):**
Same 90-day window as Run 1's addendum (too little time has passed for meaningful movement). Owner asked to explicitly target more English phrasings ("fun things to do in Zichron Yaakov", "family activities Zichron Yaakov", "children's activities Zichron Yaakov"). Checked the real data for these: no exact matches yet, but close variants are already getting isolated impressions — "fun activities to do" (1 impression, position 1.0), "indoor fun places for kids" (1, position 15), "rainy day activities for kids" (1, position 10), "kids and fun" (1, position 2.0). Target query list in the playbook updated to include these phrasings explicitly, and `TARGET_QUERIES_SUBSTRINGS` in the script updated ("children", "fun", "activities" added) so future reports surface matches on them.

**Technical audit findings:**
- Clean. All 14 pages (7 English + 7 Hebrew) have valid title/meta description/canonical/hreflang/JSON-LD — no broken images, no oversized images (only one at 262KB, already compressed from 1.9MB in Run 1, not worth further squeezing), all pages present in `sitemap.xml`.
- The underperforming query flagged in Run 1 ("מסיבת יום הולדת לילדים", avg position 11.6) is already exactly matched by `birthday.html`'s title tag — there's no further on-page optimization to make here. The low position is more likely an off-site-signals problem (backlinks/reviews/directory listings) than a content gap.

**Fixes made:** (PR link: to be added on merge)
- Reworked the homepage's "Fun Things to Do" section copy (English + Hebrew) to explicitly include "fun things to do in Zichron Yaakov" and "children's activity" phrasing, alongside the "family activity" wording already there — natural sentence, not keyword-stuffed.
- Updated `seo/AGENT_PLAYBOOK.md`'s target query list and `search_console_report.py`'s topic-matching substrings per the owner's request.

**Still open / needs owner action:**
- **Needs a direct answer before acting:** real Search Console data shows meaningful volume (33 impressions, position 7.5) for "מכונות משחק לאירועים בזיכרון יעקב" — literally "game machines for events in Zichron Yaakov." That phrasing reads like someone searching for a mobile/rental arcade service brought to their own venue, which is a different offering than the Group Rates page (groups visiting RKD's own location). Did not add this to any page copy without confirming RKD actually offers that service — adding it otherwise would be an inaccurate claim.
- Recommend: get RKD listed on karamel.co.il and tiuli.com (carried over from Run 1 — still not done).
- Recommend: confirm Google Business Profile is complete, and start collecting Google reviews (carried over from Run 1 — still not done).
- Watch the `http://` vs `https://` homepage split in Search Console over the next few runs — should fade out if it's just old data, as suspected; if the `http://` count keeps growing instead, that means it's a live redirect problem worth investigating harder.

## Run 3 — 2026-11-26

Follow-up to Run 2: owner asked how to get the exact target phrases (not just the underlying concept) to literally appear on the site, in both languages.

**What was done:** Audited all 10 target phrases (5 English, 5 Hebrew) from the playbook against the live page text with exact substring matching. 4 English and 2 Hebrew phrases were only approximately covered (right concept nearby, but not the literal contiguous phrase) — reworked the homepage About/intro copy and the birthday page's meta description, in both languages, so every target phrase now appears verbatim at least once:
- EN: "fun things to do in Zichron Yaakov", "family activities Zichron Yaakov", "children's activities Zichron Yaakov", "arcade Zichron Yaakov" (all on `index.html`), "kids birthday party Zichron Yaakov" (`birthday.html`)
- HE: "דברים כיפיים לעשות בזכרון יעקב", "פעילות משפחתית בזכרון יעקב", "פעילויות לילדים בזכרון יעקב", "ארקייד בזכרון יעקב" (all on `he/index.html`), "מסיבת יום הולדת לילדים בזכרון יעקב" (`he/birthday.html`)

Kept it to one natural sentence per phrase rather than repeating any phrase multiple times per page — exact-match keyword stuffing is a known negative signal, not a positive one, so the goal was "present once, naturally," not maximum repetition.

**Fixes made:** (PR link: to be added on merge) — see files listed above.

**Still open / needs owner action:** unchanged from Run 2 (karamel.co.il/tiuli.com listing, Google Business Profile, reviews, the "מכונות משחק לאירועים" service-offering question, watching the http/https split).

## Run 4 — 2026-11-26

Owner clarified the real goal: iterate over **all** real, relevant search phrases in both languages — not a fixed hand-picked list — until each one sits at page 1 (avg position ≤10). Rebuilt the agent around this: `seo/search_console_report.py` now maintains a persistent `seo/keyword_tracker.json`, auto-populated from every real query Search Console reports that matches the topic-relevance filter, tracking each one's position over time and its `targeting` / `page1` status. The playbook's "Target queries" section is rewritten accordingly — the fixed list becomes a handful of seed phrases, not the actual target set.

**Keyword tracker summary (first run of the tracker, seeded from current data):**
- 27 relevant queries already at page 1 (no action)
- 16 relevant queries not yet at page 1 ("new opportunities," since this is the tracker's first run — nothing was previously tracked)
- 0 promoted, 0 "still targeting" (both expected to populate starting next run, once this run's targets get re-checked)
- Caught a false positive: "ערכות לגיל הזהב זכרון וקשר" (15 impressions, position 56.9) matched the relevance filter only because "זכרון" generically means "memory" in Hebrew, not because it's about Zichron Yaakov — it's a senior-citizens program, unrelated to this business. Documented in the playbook as a known filter risk; did not treat it as a real opportunity.

**Fixes made (targeting 3 of the 16 opportunities):** (PR link: to be added on merge)
- "מסיבת יום הולדת לילדים" (5 impressions, position 11.6 — closest near-miss): the exact phrase was already in `birthday.html`'s title/meta, but the page's most prominent H1 used the *plural* "מסיבות" where the real query is *singular* "מסיבת" — fixed the H1 (both `birthday.html` and `he/birthday.html`) to match the singular form people actually search.
- "air hockey arcade" (2 impressions, position 13.0): added the exact phrase to `air-hockey.html` / `he/air-hockey.html`'s tagline, which didn't contain it before.
- "משחקי וידאו לילדים בזיכרון יעקב" (3 impressions, position 14.3): added "video games" / "משחקי וידאו" as an explicit synonym alongside "arcade games" / "משחקי ארקייד" on the homepage (`index.html`, `he/index.html`), since the site previously only used "arcade games" wording.

**Still open / needs owner action:** unchanged from Run 2/3 (karamel.co.il/tiuli.com listing, Google Business Profile, reviews, the "מכונות משחק לאירועים" service-offering question, watching the http/https split) — plus: next run should check whether these 3 fixes moved their target queries' positions.

## Run 5 — 2026-11-26

Owner relayed a suggestion (from asking Gemini about similar agent setups) to add keyword-expansion/autocomplete-based research, to find real searches the site has zero visibility on — not just improve queries it already shows up for. Declined the specific third-party tools suggested (installing an unreviewed third-party MCP server or plugin means running someone else's code with real tool-calling permissions — a real supply-chain risk not worth taking when we already have a working equivalent) and built this ourselves: `seo/keyword_expansion.py` queries Google's own public autocomplete endpoint directly (no API key, no third-party service) with root phrases in both languages, and feeds new candidates into `seo/keyword_tracker.json` with status `candidate`.

**Keyword expansion run (first time):**
- 10 root phrases (5 English, 5 Hebrew) → 20 new on-topic candidates added to the tracker, 0 already known
- Real finds worth noting: "פעילויות גיבוש בזכרון יעקב" (team-building activities) — a genuinely new angle the site never mentioned; "אטרקציות בזכרון יעקב למבוגרים/לזוגות" (for adults/for couples) — audience segments beyond "kids and families" that autocomplete surfaced; "משחקיה" as a real alternate Hebrew word for "play center" people search, distinct from "ארקייד"
- Filtered out off-topic noise automatically (hotels/restaurants/winery dominate generic "Zichron Yaakov" autocomplete — added an exclude list rather than treating those as opportunities)

**Fixes made (1 of the 20 candidates, per the playbook's "1-2 per run" guidance):** (PR link: to be added on merge)
- Added "team-building outing" / "פעילויות גיבוש בזכרון יעקב" to `group-rates.html` / `he/group-rates.html`'s intro copy — a true repositioning of the existing group-visit offering (not a new claimed service), alongside the school-trip/family-reunion framing already there.

**Still open / needs owner action:** unchanged from Run 4, plus: the other 19 candidates from this run are logged in the tracker for future runs to consider (notably the "for adults"/"for couples" angle, which could suit the existing air hockey tournament page).

## Run 6 — 2026-11-26

Demo/test run at the owner's request, to show the full loop end-to-end: search → real rank → fix → redeploy → re-check.

**Keyword tracker summary:** 0 promoted, 0 new opportunities, 16 still targeting, 27 already page 1. (Same 90-day data window as Run 5 — too soon since the last fetch for Google to have recrawled anything; the 16 "still targeting" queries are the same ones from Run 4/5, now correctly carried forward by the tracker instead of re-appearing as "new.")

**Two more real queries acted on this run** (from the "still targeting" list, not yet touched in prior runs):
- "indoor fun places for kids" / "games and arcades" (positions 15 / 14): the word "indoor" didn't appear anywhere on the site despite RKD genuinely being an indoor venue — added "an indoor play spot" (EN) / "משחקייה מקורה" (HE) to the homepage About section.
- "משחקייה" / "משחקייה לילדים" (play center for kids, position 62, and also independently surfaced by Run 5's autocomplete expansion): added "משחקייה" as a Hebrew synonym alongside "ארקייד" in the same homepage edit above.

**Flagged, not acted on (needs owner confirmation):**
- Three "escape room" queries ("חדר בריחה בזכרון", "חדר בריחה זכרון", "חדרי בריחה זכרון יעקב", positions 49–62): RKD is an arcade, not an escape room — unless the business actually also offers an escape-room feature, this is a different business category and not worth chasing.
- "יום הולדת גיימינג פתח תקווה" (birthday gaming in Petah Tikva, position 21): Petah Tikva is a different city entirely — likely Google surfacing a tangentially related page, not a realistic target.

**On re-running immediately after the fix:** the rank numbers above are unchanged from Run 5 (same real data, same 90-day window) — that's expected. Google needs real time (days to weeks) to recrawl the updated pages and re-rank them; an immediate re-check cannot show movement yet. The next genuine checkpoint is the scheduled Monday run, or any manual run from here forward — if "indoor"/"משחקייה"-related queries climb or start getting more impressions in future runs, that's the fix working.

**Still open / needs owner action:** unchanged from Run 5, plus the escape-room and Petah Tikva questions above.

## Run 7 — 2026-11-26

Owner asked specifically about "activities for kids Zichron" and asked to formalize an explicit master list of prompts the agent checks (not just dynamically discovered ones).

**Validated via Google's own autocomplete** (not guessed — only added if Google echoed it back as a recognized real query): "kids activities zichron yaakov" (EN) and "מה לעשות עם ילדים בזכרון יעקב" / "דברים לעשות בזכרון יעקב" (HE) were all real, confirmed searches, and none were on the site yet.

**Fixes made:** (PR link: to be added on merge)
- Added "kids activities Zichron Yaakov" to the homepage's opening hook sentence (EN)
- Added "מה לעשות עם ילדים בזכרון יעקב" and "דברים לעשות בזכרון יעקב" (the plain, non-"כיפיים" variant) to the homepage's opening hook sentence (HE)
- Added the newly-validated phrases to `ROOT_PHRASES` in `seo/keyword_expansion.py` and ran it — found 6 new candidates ("zichron yaakov events," "דברים לעשות בזכרון יעקב והסביבה," "דברים לעשות בזכרון יעקב בשבת," among others)
- Added a full **master prompt list** to `seo/AGENT_PLAYBOOK.md` — every phrase the agent checks, with status, so it's a reviewable, explicit list rather than scattered across run logs

**Still open / needs owner action:** unchanged from Run 6, plus the new candidates from this run's expansion (notably "zichron yaakov events" and the "והסביבה"/"and surroundings" pattern, which keeps recurring in Hebrew autocomplete — may be worth a dedicated angle in a future run).
