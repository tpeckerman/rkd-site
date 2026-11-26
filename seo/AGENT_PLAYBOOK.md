# SEO agent playbook

This is the fixed process an SEO run follows for rkdzichron.com, whether it's
triggered manually or by the weekly scheduled task. Each run appends an entry
to `seo/SEO_LOG.md` so the next run has history to compare against.

## The actual goal

**Not** "does the site show up for a fixed list of ~10 phrases we picked."
**Is**: every real, relevant query — in English and Hebrew — that Search
Console shows people actually typing should eventually sit at average
position 10 or better (page 1 — Google shows roughly 10 organic results).
That's a growing, data-driven set, not a closed list: the site's own real
search traffic defines what to chase, and the set gets bigger as the site
gets more visibility (more impressions surface more real queries).

This is tracked in **`seo/keyword_tracker.json`**, maintained automatically
by `seo/search_console_report.py` (real queries the site already has some
visibility on) and `seo/keyword_expansion.py` (real queries it has ZERO
visibility on yet — see "Keyword expansion" below). Don't hand-maintain a
separate query list; the tracker IS the list, built from real data.

**Relevance filter, not a closed list:** `TARGET_QUERIES_SUBSTRINGS` in
`search_console_report.py` decides which of the real queries Search Console
reports are "on topic" for this business (vs. noise — see the false-positive
note below). Add to it whenever a genuinely new relevant term turns up (e.g.
"מכונות משחק" was added after Run 1 found "מכונות משחק לאירועים בזיכרון יעקב"
with real volume). This filter should grow; it should almost never shrink.

**Known false-positive risk:** the Hebrew word "זכרון" literally means
"memory," not just "Zichron" — Run 4 found an irrelevant query
("ערכות לגיל הזהב זכרון וקשר", about a senior-citizens program, nothing to do
with this business) that matched purely on that generic word. Use judgment
before treating every substring match as a real opportunity — check that the
query is actually about family/kids/arcade/Zichron-Yaakov-the-town, not just
that it happens to contain one of the filter words.

## Master prompt list

The explicit set of phrases this agent checks against — every one of these
has been validated as a real search (either real Search Console impressions,
or echoed back by Google's own autocomplete as a recognized query — not
guessed). ✅ = already appears verbatim on the site. This list only grows;
when a new validated phrase is found, add it here, to `ROOT_PHRASES` in
`seo/keyword_expansion.py` (if it's a good root for further expansion), and
to `TARGET_QUERIES_SUBSTRINGS` in `seo/search_console_report.py` if it
introduces a new relevant word the filter doesn't already catch.

**English:**
| Phrase | Status |
|---|---|
| things to do in Zichron Yaakov | ✅ page 1 (via "fun activities to do," #1) |
| fun things to do in Zichron Yaakov | ✅ on page |
| best things to do in Zichron Yaakov | candidate |
| things to see in Zichron Yaakov | candidate |
| kids activities Zichron Yaakov | ✅ on page (Run 7) |
| family activities Zichron Yaakov | ✅ on page |
| children's activities Zichron Yaakov | ✅ on page |
| indoor fun places for kids | ✅ page 1 |
| rainy day activities for kids | ✅ page 1 |
| kids birthday party Zichron Yaakov | ✅ on page |
| arcade Zichron Yaakov | ✅ on page |
| arcade near me | ✅ page 1 |
| air hockey arcade | ✅ on page |
| zichron yaakov events | candidate |

**Hebrew:**
| Phrase | Status |
|---|---|
| דברים כיפיים לעשות בזכרון יעקב | ✅ on page |
| דברים לעשות בזכרון יעקב (no "כיפיים") | ✅ on page (Run 7) |
| דברים לעשות בזכרון יעקב והסביבה | candidate |
| מה לעשות עם ילדים בזכרון יעקב | ✅ on page (Run 7) |
| אטרקציות בזכרון יעקב | ✅ page 1 |
| אטרקציות לילדים בזכרון יעקב | still targeting (position ~54, far off) |
| אטרקציות למשפחה בזכרון יעקב | candidate |
| אטרקציות בזכרון יעקב למבוגרים / לזוגות | candidate — new audience segments (adults/couples) |
| פעילות משפחתית בזכרון יעקב | ✅ on page |
| פעילויות לילדים בזכרון יעקב | ✅ on page |
| פעילויות בזכרון יעקב והסביבה | candidate |
| פעילויות גיבוש בזכרון יעקב | ✅ on page |
| משחקייה / משחקייה לילדים בזכרון יעקב | ✅ on page |
| מסיבת יום הולדת לילדים בזכרון יעקב | ✅ on page, singular form matches real query |
| ארקייד בזכרון יעקב | ✅ on page |
| מכונות משחק לאירועים בזכרון יעקב | page 1, but intent unconfirmed (see Run 2) |

**Flagged — real queries, deliberately not targeted** (wrong business/location,
not worth chasing with on-page work):
- "ערכות לגיל הזהב זכרון וקשר" — false positive, "זכרון" = generic word "memory"
- "חדר בריחה ב/זכרון/זכרון יעקב" (escape room) — different business category than an arcade
- "יום הולדת גיימינג פתח תקווה" — different city (Petah Tikva)
- "דברים לעשות בזכרון יעקב בשבת" (Shabbat-specific) — only worth targeting if the business is actually open Saturdays

## Process

1. **Re-sync first.** `git fetch origin main` and branch off the current
   `origin/main` — not off whatever local branch was last used. This repo's
   `main` gets squash-merged, which rewrites history on every PR merge, so an
   old local branch will look "diverged" even when its content is identical.
   Site content also changes independently of SEO work (new pages, pricing,
   features) — always re-read the live files before assuming their state.

2. **Baseline check — real data, full query set.** Run
   `python3 seo/search_console_report.py` (see "Search Console access"
   below). This calls the real Search Console API, updates
   `seo/keyword_tracker.json` with every relevant query's current position,
   and prints four buckets: queries **promoted** to page 1 since last check
   (a win — note it), **new opportunities** (relevant, real, not yet page 1),
   **still targeting** (tracked before, still not page 1 — these are your
   best candidates, since you already tried once), and **page 1** (already
   there — just confirm they're holding, no action needed).

   **If the script exits with an error** (e.g. the Doppler credential or
   `api.doppler.com` network access is missing from this session's
   environment for some reason), fall back to a `WebSearch` for the seed
   phrases listed above instead, and **say plainly in the log that this
   fallback was used and why** — don't present it as equivalent to real
   data, and don't update the tracker from approximate data.

3. **Technical audit.** Check every page (English root + `/he/` mirror):
   - `<title>`, meta description, canonical, hreflang (en/he/x-default) all
     present and pointing to the right URLs
   - `LocalBusiness`/`EntertainmentBusiness` JSON-LD present and valid
     (`python3 -c "import json,re; ..."` — parse each page's ld+json block)
   - Every page in `sitemap.xml` and not blocked by `robots.txt`
   - No broken image references (`<img src>` pointing at a file that doesn't
     exist in `images/`)
   - No oversized images (anything over ~300KB for a page image is worth
     compressing — `identify` + `convert -resize -strip -quality 80`)
   - Any new page added since the last run has the same SEO treatment as the
     rest of the site (title/description/hreflang/schema) — new features
     (e.g. the booking page) get built without this by default

4. **Pick 1–3 concrete fixes**, combining what step 2's tracker surfaced and
   step 3's technical audit found. For keyword opportunities, prioritize
   "still targeting" queries with decent impressions and a position in the
   teens/twenties (close to page 1, worth pushing) over position 50+ queries
   (too far off to realistically move with on-page work alone) or 1-impression
   queries (too little signal to bother with yet). For each one you work on:
   find or add a page whose actual topic matches the query's intent, and work
   the query's real wording into that page's prominent elements (H1, title,
   or meta description, in whichever language the query was in) — a phrase
   buried once in body copy carries less weight than one in a heading. Prefer
   fixing real gaps over speculative changes; don't rewrite copy that's
   already reasonable just to have something to do this run.

   **Sanity-check the query's actual intent before writing copy for it.**
   Run 2 found a real, high-volume query ("מכונות משחק לאירועים בזיכרון
   יעקב") that reads like a *different offering* (mobile/rental arcade
   machines for off-site events) than anything on the Group Rates page
   (groups visiting RKD's own location) — don't add page copy implying a
   service the business doesn't actually offer. When a query's intent is
   ambiguous or might not match a real offering, flag it in the log under
   "Still open" and ask the owner, rather than guessing.

   **Rewrite before you append.** Before adding a new sentence to cover a
   phrase, check whether something already on the page is close to the
   same idea and could be reworded to cover it instead — a rewritten
   sentence that reads better AND covers the phrase beats a bolted-on
   extra sentence that only covers the phrase. The test for every edit:
   would a real visitor find this clearer or more appealing, independent
   of SEO? If the honest answer is no — if the only reason the sentence
   exists is to contain a keyword — rewrite it until the answer is yes.
   Every fix in Runs 1-7 was written to this bar; keep it that way as the
   page accumulates more targeted phrases over time, since a page that
   reads like a keyword list is a credibility and conversion problem for
   actual visitors, not just an aesthetic one — and Google's quality
   signals increasingly penalize exactly that pattern too.

   **Give up on a query gracefully, don't loop on it forever.** If a
   specific query has had on-page changes made across 4 separate runs
   with no improvement in position, stop making further on-page edits
   for it. Mark it in the log as "needs off-site work, not more on-page
   copy" (link to the relevant "Known gaps" item — backlinks, directory
   listings, reviews) and move on to a different opportunity. On-page
   wording can only do so much against competition and authority; don't
   keep rewording the same sentence indefinitely hoping the phrasing is
   the problem.

5. **Record every fix before deploying.** For each query you targeted this
   run, call `record_edit(tracker, query, run, description, page, pr_link)`
   from `seo/search_console_report.py` (import it, or add the call inline
   in a short script) — `run` is whatever `next_run_number()` returned this
   run. This feeds two things: the per-query edit count that drives the
   "give up after 4 edit runs" rule above, and the Changes log that
   `seo/sheets_sync.py` publishes. Skipping this doesn't break anything
   immediately, but it silently breaks both of those later.

6. **Deploy**, matching how this repo works:
   - Branch from `origin/main`: `git checkout -B claude/seo-agent-run-N origin/main`
   - Commit, push, open a PR against `main`, merge (squash) — if the merge
     call fails with "Pull Request has merge conflicts", it's almost always
     this repo's squash-merge history issue, not a real conflict: branch a
     temp branch from the current `origin/main`, `git cherry-pick` your
     commit onto it, force-push that onto your branch, and retry the merge.
   - GitHub Pages redeploys automatically after merge
   - `seo/keyword_tracker.json` gets updated by step 2 and should be
     committed as part of this run's PR, alongside any content fixes

7. **Sync to Google Sheets** (if `SEO_SHEET_ID` is configured — see "Rank
   tracking spreadsheet" below): `python3 seo/sheets_sync.py`. This isn't a
   source of truth — `seo/keyword_tracker.json` is — it's a read-only export
   for the owner to glance at without needing to read JSON or PRs.

8. **Log the run** in `seo/SEO_LOG.md` (template below).

## Search Console access

`seo/search_console_report.py` authenticates as a Google service account
(`seo-reader@rkd-seo.iam.gserviceaccount.com`, added as a Restricted user on
the `sc-domain:rkdzichron.com` property) and queries the real Search Console
API. It signs its own JWT via `openssl` rather than the
`google-auth`/`cryptography` Python stack, which has a broken `cffi` install
in this environment.

The service-account key itself is never committed to this repo (it's
public) and is never pasted into a session by hand anymore. It lives in
**Doppler** (project `rkd-seo`, config `prd`, secret `GOOGLE_SA_KEY_JSON`),
and the script fetches it at runtime with a plain HTTPS GET to
`api.doppler.com` — no Doppler token appears anywhere in the script or this
repo, because the session's network proxy injects the `Authorization`
header automatically (a Doppler service token was saved once via
`request_credential` for the `api.doppler.com` host, which persists at the
**environment** level — this is why it works for the unattended weekly job
too, not just interactive sessions). If that fetch fails (401/403 because
the credential isn't configured on whatever environment this is running in,
or the host isn't reachable), the script falls back to a local key file at
`~/.secrets/rkd-seo-sa.json` / `$GOOGLE_SA_KEY_FILE` for convenience, then
gives up with a clear error — at that point, fall back to WebSearch per
step 2 and say so in the log.

It also needs `oauth2.googleapis.com`, `www.googleapis.com`,
`searchconsole.googleapis.com` and `api.doppler.com` reachable, which were
added to the environment's network allowlist once via `update_environment`
and should already be there for any session using the same "Default"
environment.

Each run, the script rewrites `seo/keyword_tracker.json` in place with every
relevant query's current position and status (`targeting` or `page1`) — this
file is the persistent memory of "what are we chasing and how's it going,"
across however many runs it takes. Commit it every run, even if a query's
position barely moved; the `best_position`/`first_seen`/`promoted_date`
fields are what let a future run tell real progress from noise.

## Keyword expansion (finding blind spots, not just weak rankings)

`seo/search_console_report.py` can only ever surface a query the site
already has at least one impression on — it's blind to real searches the
site doesn't show up for *at all* yet. `seo/keyword_expansion.py` closes
that gap: it queries Google's public autocomplete endpoint
(`suggestqueries.google.com`, no API key, no third-party service) with a
curated list of root phrases in both languages, and adds anything new to
`seo/keyword_tracker.json` with status `candidate` (no position exists yet
— that's the point). If a candidate later starts showing real impressions,
the next Search Console run naturally promotes it to `targeting`/`page1`,
since both scripts key off the literal query string.

This needs `suggestqueries.google.com` reachable (added to the environment
allowlist the same way as the other hosts above). It doesn't need to run
every single week — the root phrases and what Google suggests for them
don't change fast — every few weeks is plenty. When it finds genuinely new,
on-topic angles (Run 5 found "פעילויות גיבוש" — team-building — and several
audience segments like "for couples"/"for adults" that autocomplete
surfaced but the site never mentioned), treat them as candidates for new
content, not fixes to existing pages — add 1-2 per run at most, and expect
most to not pan out. Keep `ROOT_PHRASES` and `OFF_TOPIC_SUBSTRINGS` in the
script updated as you learn what's relevant vs. noise, the same way
`TARGET_QUERIES_SUBSTRINGS` gets maintained.

## Rank tracking spreadsheet

**Live since 2026-11-26.** `seo/sheets_sync.py` publishes
`seo/keyword_tracker.json` to a Google Sheet for the owner — not a second
source of truth, a read-only view of the same JSON. The sheet ID is
hardcoded as the default in `sheets_sync.py` (not a secret — access is
controlled by the sheet's own Google sharing permissions, not by the ID
being unknown). Just run `python3 seo/sheets_sync.py` after any run that
touches the tracker; no setup needed anymore. Two tabs:
- **Rankings**: one row per phrase, one column per run (label "Run N
  (date)"), the cell is that phrase's average position in that run. Blank
  means the phrase wasn't tracked yet at that point. New phrases appear as
  new rows automatically — no manual upkeep. (Position history only exists
  from Run 7 onward, when this field was added — earlier runs only have
  their final first/best/current values, not a full per-run trail.)
- **Changes**: one row per `record_edit()` call ever made — run, date,
  query, what changed, which page, PR link.

If `sheets_sync.py` ever starts failing (e.g. the sheet got unshared, or
`sheets.googleapis.com` drops off the environment's network allowlist for
some reason), don't treat that as a reason to stop the rest of the run —
`seo/keyword_tracker.json` is the real record either way; just note the
sync failure in the log.

## Known gaps / off-site recommendations

These need the site owner's own action — flag them each run until done,
don't try to automate them:

- **Local directory listings.** Sites like karamel.co.il, tiuli.com, and
  easy.co.il dominate the generic "kids attractions near X" searches in
  Hebrew. Getting RKD listed there would likely move the needle more than
  on-page tweaks. Requires the owner to submit/claim a listing.
- **Google Business Profile.** Confirm it exists and is fully filled out
  (hours, category, photos) — this is usually the single biggest lever for
  "things to do near me" style searches, and isn't something this repo
  controls.
- **Reviews.** Review count/quality on Google is a major local ranking
  factor and can't be generated by editing the site.

## Log entry template

```
## Run N — YYYY-MM-DD

**Keyword tracker summary:** (counts from this run's script output — promoted / new opportunities / still targeting / page 1 — plus anything noteworthy, like a promotion worth celebrating or a false-positive filtered out)

**Technical audit findings:**
- ...

**Fixes made:** (PR link) — which query/queries each fix targets, and which page/element it was added to
- ...

**Still open / needs owner action:**
- ...
```
