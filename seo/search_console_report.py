#!/usr/bin/env python3
"""Pull real Search Console performance data for rkdzichron.com.

Auth: a Google service-account JSON key, signed into a JWT and exchanged for
an OAuth2 access token. Uses `openssl` for RSA signing instead of the
google-auth/cryptography Python stack, which has a broken cffi/cryptography
install in this environment.

The service account must be added as a user (Restricted is enough) on the
Search Console property at https://search.google.com/search-console
(Settings -> Users and permissions).

The key itself is never committed to this repo (it's public). It's fetched,
in order:
  1. From Doppler (project rkd-seo, config prd, secret GOOGLE_SA_KEY_JSON),
     via a plain HTTPS GET to api.doppler.com. This works in ANY session,
     including the unattended weekly job, as long as that session's
     environment has a Doppler API credential configured (via
     request_credential) — the network proxy injects the Authorization
     header automatically, so this script never needs the Doppler token
     itself, only network access to api.doppler.com.
  2. A local key file, for convenience: $GOOGLE_SA_KEY_FILE, or
     ~/.secrets/rkd-seo-sa.json.

Usage:
    python3 seo/search_console_report.py
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import urllib.parse

SITE_URL = "sc-domain:rkdzichron.com"
SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
TOKEN_URI = "https://oauth2.googleapis.com/token"
API_URL = f"https://www.googleapis.com/webmasters/v3/sites/{urllib.parse.quote(SITE_URL, safe='')}/searchAnalytics/query"

DOPPLER_PROJECT = "rkd-seo"
DOPPLER_CONFIG = "prd"
DOPPLER_SECRET_NAME = "GOOGLE_SA_KEY_JSON"
DOPPLER_API_URL = (
    f"https://api.doppler.com/v3/configs/config/secret"
    f"?project={DOPPLER_PROJECT}&config={DOPPLER_CONFIG}&name={DOPPLER_SECRET_NAME}"
)

TARGET_QUERIES_SUBSTRINGS = [
    "things to do", "fun", "family", "children", "kids", "birthday", "arcade", "activities",
    "אטרקציות", "פעילויות", "ילדים", "משפחה", "יום הולדת", "ארקייד", "מכונות משחק", "zichron", "זכרון",
]
# This is a RELEVANCE FILTER, not a closed list: any real query containing one
# of these substrings is "on topic" for the business and gets tracked, whether
# or not we specifically wrote it into the playbook. Add to this list whenever
# a new relevant term turns up in real data (e.g. "מכונות משחק" was added
# after Run 1 found "מכונות משחק לאירועים בזיכרון יעקב" with real volume) —
# the goal is to keep covering the full, growing set of real searches in both
# languages, not a fixed set of hand-picked phrases.

PAGE1_POSITION = 10.5  # avg_position <= this counts as "page 1" (Google shows ~10 results)
MIN_IMPRESSIONS_TO_TRACK = 1

TRACKER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "keyword_tracker.json")


def is_hebrew(text: str) -> bool:
    return any("֐" <= ch <= "׿" for ch in text)


def load_tracker() -> dict:
    if os.path.exists(TRACKER_PATH):
        with open(TRACKER_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {"queries": {}}


def save_tracker(tracker: dict) -> None:
    import datetime
    tracker["last_updated"] = datetime.date.today().isoformat()
    with open(TRACKER_PATH, "w", encoding="utf-8") as f:
        json.dump(tracker, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


GIVE_UP_AFTER_EDITS = 4  # stop making on-page edits for a query after this many runs with edits and no promotion


def next_run_number(tracker: dict) -> int:
    """Call once per run, before update_tracker, to get this run's number
    (also used as the Sheets/log run label) — persisted so it's consistent
    regardless of what seo/SEO_LOG.md says."""
    tracker["run_count"] = tracker.get("run_count", 0) + 1
    return tracker["run_count"]


def record_edit(tracker: dict, query: str, run: int, description: str, page: str, pr_link: str = None) -> None:
    """Call this once per query a run makes an on-page edit for — feeds both
    the per-query edit count (for the give-up rule) and the tracker-level
    changes log (for the Sheets "Changes" tab / seo/SEO_LOG.md)."""
    import datetime
    today = datetime.date.today().isoformat()
    entry = tracker.setdefault("queries", {}).setdefault(query, {})
    entry.setdefault("edits", []).append({"run": run, "date": today})
    changes = tracker.setdefault("changes_log", [])
    changes.append({
        "run": run, "date": today, "query": query, "description": description,
        "page": page, "pr_link": pr_link,
    })


def queries_to_abandon(tracker: dict) -> list[str]:
    """Queries that have had edits in >= GIVE_UP_AFTER_EDITS runs, are still
    'targeting' (never reached page1), and haven't already been marked
    abandoned — per the playbook's 'give up gracefully' rule. Call after
    update_tracker; mark returned queries in this run's log entry, then set
    their status to 'abandoned' so future runs stop re-flagging them."""
    abandoned = []
    for q, entry in tracker.get("queries", {}).items():
        if entry.get("status") == "targeting" and len(entry.get("edits", [])) >= GIVE_UP_AFTER_EDITS:
            abandoned.append(q)
    return abandoned


def update_tracker(tracker: dict, rows: list, run: int) -> dict:
    """Update the persistent keyword tracker from this run's real data.
    Returns a summary dict: new_opportunities, promoted, still_targeting,
    page1 — lists of query dicts — for the caller to report and act on."""
    import datetime
    today = datetime.date.today().isoformat()
    queries = tracker.setdefault("queries", {})

    relevant = [r for r in rows if r["impressions"] >= MIN_IMPRESSIONS_TO_TRACK
                and any(s.lower() in r["keys"][0].lower() for s in TARGET_QUERIES_SUBSTRINGS)]

    new_opportunities, promoted, still_targeting, page1 = [], [], [], []

    for r in relevant:
        q = r["keys"][0]
        pos = r["position"]
        is_page1 = pos <= PAGE1_POSITION
        entry = queries.get(q)
        if entry is None:
            entry = {
                "language": "he" if is_hebrew(q) else "en",
                "first_seen": today,
                "first_position": pos,
                "best_position": pos,
                "status": "page1" if is_page1 else "targeting",
                "promoted_date": today if is_page1 else None,
            }
            queries[q] = entry
            (page1 if is_page1 else new_opportunities).append({**r, "query": q})
        else:
            was_page1 = entry["status"] == "page1"
            entry["best_position"] = min(entry["best_position"], pos)
            if is_page1 and not was_page1:
                entry["status"] = "page1"
                entry["promoted_date"] = today
                promoted.append({**r, "query": q})
            elif is_page1:
                page1.append({**r, "query": q})
            else:
                still_targeting.append({**r, "query": q})
        entry["current_position"] = pos
        entry["current_impressions"] = r["impressions"]
        entry["last_checked"] = today
        entry.setdefault("history", []).append({
            "run": run, "date": today, "position": pos, "impressions": r["impressions"],
        })

    return {
        "new_opportunities": sorted(new_opportunities, key=lambda r: -r["impressions"]),
        "promoted": sorted(promoted, key=lambda r: -r["impressions"]),
        "still_targeting": sorted(still_targeting, key=lambda r: -r["impressions"]),
        "page1": sorted(page1, key=lambda r: -r["impressions"]),
    }


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign_rs256(private_key_pem: str, signing_input: bytes) -> bytes:
    with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as kf:
        kf.write(private_key_pem)
        key_path = kf.name
    try:
        proc = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", key_path],
            input=signing_input, capture_output=True, check=True,
        )
        return proc.stdout
    finally:
        os.unlink(key_path)


def load_from_doppler() -> dict | None:
    """Fetch the service-account JSON from Doppler. Returns None (not an
    error) if the Doppler credential isn't configured in this session's
    environment — callers should fall back to a local file in that case."""
    req = urllib.request.Request(DOPPLER_API_URL)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.load(resp)
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            return None  # no Doppler credential in this session — fall back
        raise
    except urllib.error.URLError:
        return None  # host not reachable from this session — fall back
    return json.loads(body["value"]["raw"])


def load_service_account_credentials() -> dict:
    creds = load_from_doppler()
    if creds is not None:
        print("Loaded service-account key from Doppler.", file=sys.stderr)
        return creds

    key_file = os.environ.get("GOOGLE_SA_KEY_FILE", DEFAULT_KEY_FILE)
    if not os.path.exists(key_file):
        print("Could not load the key from Doppler, and no local key file found at "
              f"{key_file}.", file=sys.stderr)
        print("Either configure the Doppler credential for api.doppler.com in this "
              f"session, or set GOOGLE_SA_KEY_FILE / place a key at {DEFAULT_KEY_FILE}.",
              file=sys.stderr)
        sys.exit(1)
    print(f"Loaded service-account key from local file {key_file}.", file=sys.stderr)
    with open(key_file, encoding="utf-8") as f:
        return json.load(f)


def get_access_token(creds: dict) -> str:
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    claims = {
        "iss": creds["client_email"],
        "scope": SCOPE,
        "aud": TOKEN_URI,
        "iat": now,
        "exp": now + 3600,
    }
    signing_input = b64url(json.dumps(header).encode()) + "." + b64url(json.dumps(claims).encode())
    signature = sign_rs256(creds["private_key"], signing_input.encode())
    jwt = signing_input + "." + b64url(signature)

    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt,
    }).encode()
    req = urllib.request.Request(TOKEN_URI, data=body, method="POST",
                                  headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)["access_token"]


def query_search_analytics(access_token: str, days: int = 90, dimensions=("query",), row_limit=5000):
    import datetime
    end = datetime.date.today() - datetime.timedelta(days=3)  # SC data lags ~2-3 days
    start = end - datetime.timedelta(days=days)
    body = json.dumps({
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dimensions": list(dimensions),
        "rowLimit": row_limit,
    }).encode()
    req = urllib.request.Request(API_URL, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}",
    })
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


DEFAULT_KEY_FILE = os.path.expanduser("~/.secrets/rkd-seo-sa.json")


def print_rows(rows, label):
    print(f"-- {label} ({len(rows)}) --")
    if not rows:
        print("  (none)")
    for r in rows:
        print(f"  '{r['query']}'  clicks={r['clicks']}  impressions={r['impressions']}  "
              f"ctr={r['ctr']:.1%}  avg_position={r['position']:.1f}")
    print()


def main():
    creds = load_service_account_credentials()
    token = get_access_token(creds)

    print(f"=== Search Console performance for {SITE_URL}, last 90 days ===\n")

    by_query = query_search_analytics(token, dimensions=("query",))
    rows = by_query.get("rows", [])
    if not rows:
        print("No query data returned at all — property may be too new, or no impressions yet.")
    else:
        print(f"Total distinct queries with impressions: {len(rows)}\n")

        tracker = load_tracker()
        run = next_run_number(tracker)
        summary = update_tracker(tracker, rows, run)

        to_abandon = queries_to_abandon(tracker)
        for q in to_abandon:
            tracker["queries"][q]["status"] = "abandoned"

        save_tracker(tracker)

        print(f"=== KEYWORD TRACKER — run {run} (goal: every relevant query at avg_position <= 10) ===\n")
        print_rows(summary["promoted"], "PROMOTED TO PAGE 1 since last check — worth noting as a win")
        print_rows(summary["new_opportunities"], "NEW relevant queries not yet on page 1 — candidates to target")
        print_rows(summary["still_targeting"], "Still below page 1, tracked before — pick 1-3 of these to improve this run")
        print_rows(summary["page1"], "Already on page 1 (no action needed, just confirming they're holding)")

        if to_abandon:
            print(f"-- GIVING UP on {len(to_abandon)} quer{'y' if len(to_abandon)==1 else 'ies'} after "
                  f"{GIVE_UP_AFTER_EDITS}+ edit runs with no promotion — log these as needing off-site work, not more copy --")
            for q in to_abandon:
                print(f"  '{q}'")
            print()

        print("-- Top 20 queries overall, any topic (by impressions) --")
        for r in sorted(rows, key=lambda r: -r["impressions"])[:20]:
            print(f"  '{r['keys'][0]}'  clicks={r['clicks']}  impressions={r['impressions']}  "
                  f"ctr={r['ctr']:.1%}  avg_position={r['position']:.1f}")

    print("\n=== By page ===\n")
    by_page = query_search_analytics(token, dimensions=("page",))
    for r in sorted(by_page.get("rows", []), key=lambda r: -r["impressions"]):
        print(f"  {r['keys'][0]}  clicks={r['clicks']}  impressions={r['impressions']}  "
              f"ctr={r['ctr']:.1%}  avg_position={r['position']:.1f}")


if __name__ == "__main__":
    main()
