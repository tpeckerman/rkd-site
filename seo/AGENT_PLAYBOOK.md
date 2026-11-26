# SEO agent playbook

This is the fixed process an SEO run follows for rkdzichron.com, whether it's
triggered manually or by the weekly scheduled task. Each run appends an entry
to `seo/SEO_LOG.md` so the next run has history to compare against.

## Target queries

What "ranking" means for this site — the searches a real customer would type.

English:
- things to do with kids in Zichron Yaakov
- family activities Zichron Yaakov
- kids birthday party Zichron Yaakov
- arcade Zichron Yaakov

Hebrew:
- אטרקציות למשפחה או ילדים זכרון יעקב
- פעילויות לילדים בזכרון יעקב
- מסיבת יום הולדת לילדים בזכרון יעקב
- RKD ארקייד זכרון יעקב (brand + location sanity check)

## Process

1. **Re-sync first.** `git fetch origin main` and branch off the current
   `origin/main` — not off whatever local branch was last used. This repo's
   `main` gets squash-merged, which rewrites history on every PR merge, so an
   old local branch will look "diverged" even when its content is identical.
   Site content also changes independently of SEO work (new pages, pricing,
   features) — always re-read the live files before assuming their state.

2. **Baseline check — real data.** Run `python3 seo/search_console_report.py`
   (see "Search Console access" below). This calls the real Search Console
   API and reports actual clicks/impressions/CTR/average-position per query
   and per page — ground truth, not a guess. It fetches its credentials from
   Doppler automatically, which works in any session including the
   unattended weekly job — nothing needs to be pasted in by hand anymore.

   **If the script exits with an error** (e.g. the Doppler credential or
   `api.doppler.com` network access is missing from this session's
   environment for some reason), fall back to a `WebSearch` for each target
   query instead, and **say plainly in the log that this fallback was used
   and why** — don't present it as equivalent to real data. It's a rough
   directional signal only: different search index, not geolocated to
   Israel, not authoritative.

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

4. **Pick 1–3 concrete fixes.** Prefer fixing real gaps found in step 3 over
   speculative changes. Don't rewrite copy that's already reasonable just to
   have something to do this run.

5. **Deploy**, matching how this repo works:
   - Branch from `origin/main`: `git checkout -B claude/seo-agent-run-N origin/main`
   - Commit, push, open a PR against `main`, merge (squash)
   - GitHub Pages redeploys automatically after merge

6. **Log the run** in `seo/SEO_LOG.md` (template below).

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

**Baseline search check:** (one line per target query: visible / not visible / what showed instead)

**Technical audit findings:**
- ...

**Fixes made:** (PR link)
- ...

**Still open / needs owner action:**
- ...
```
