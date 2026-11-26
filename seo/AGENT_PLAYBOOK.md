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

2. **Baseline check — real data if available, approximate otherwise.**
   Run `python3 seo/search_console_report.py` (see "Search Console access"
   below). This calls the real Search Console API and reports actual
   clicks/impressions/CTR/average-position per query and per page — this is
   ground truth, not a guess. It needs a service-account key at
   `~/.secrets/rkd-seo-sa.json` (or `$GOOGLE_SA_KEY_FILE`) in *that session's*
   environment.

   **If the key isn't present** (expected for the unattended weekly job,
   which starts from a brand-new container each time and has no safe way to
   receive a persisted private key — see "Known gaps"), fall back to a
   `WebSearch` for each target query instead, and **say plainly in the log
   that this fallback was used and why** — don't present it as equivalent to
   real data. It's a rough directional signal only: different search index,
   not geolocated to Israel, not authoritative.

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
API — no WebSearch guessing needed when this is available. It signs its own
JWT via `openssl` rather than the `google-auth`/`cryptography` Python stack,
which has a broken `cffi` install in this environment.

It needs two things in whatever session runs it:
- The hosts `oauth2.googleapis.com`, `www.googleapis.com` and
  `searchconsole.googleapis.com` allowed on the environment's network (added
  once via `update_environment`; this is saved on the environment, not the
  session, so it should already be there for any session using the same
  "Default" environment).
- The service-account JSON key at `~/.secrets/rkd-seo-sa.json` (or point
  `GOOGLE_SA_KEY_FILE` elsewhere). **Never put this key in the repo — it's
  public.** The key only exists in whatever session the user has pasted it
  into; it is not currently available to the unattended weekly job, which
  starts a fresh, empty container each time. If a future run finds the key
  present (e.g. because the persistent-session approach below was adopted),
  great — use it. If not, don't ask the user to re-paste it into an
  unattended run; fall back to WebSearch and say so in the log.

## Known gaps / off-site recommendations

These need the site owner's own action — flag them each run until done,
don't try to automate them:

- **The weekly unattended job can't use Search Console yet.** The script
  works great interactively (any session the user pastes the key into), but
  there's no safe way to hand a private key to a fresh-container job that
  fires weekly with no human present. Options worth revisiting later: point
  the weekly trigger at a persistent session instead of a fresh one and see
  whether the key file actually survives the week-long gap between firings
  (untested — containers are normally reclaimed after inactivity, so don't
  assume it works without checking), or have the owner re-paste the key on
  some cadence.
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
