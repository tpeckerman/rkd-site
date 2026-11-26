#!/usr/bin/env python3
"""Push seo/keyword_tracker.json to a Google Sheet: one tab with phrases on
the Y axis and run dates on the X axis (rank in each cell), another tab
with a running log of every site change made.

Reuses the same service-account auth as search_console_report.py (fetched
from Doppler automatically), just with the Sheets scope instead of the
Search Console one — same key, different permission.

**One-time setup before this can work:**
1. Enable the Google Sheets API for the rkd-seo GCP project:
   https://console.cloud.google.com/apis/library/sheets.googleapis.com
2. Create a Google Sheet (any name, e.g. "RKD SEO Rank Tracker").
3. Share it with seo-reader@rkd-seo.iam.gserviceaccount.com as Editor.
4. Set SPREADSHEET_ID below to the sheet's ID (from its URL:
   docs.google.com/spreadsheets/d/<THIS PART>/edit).

Usage:
    python3 seo/sheets_sync.py
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

from search_console_report import (
    load_service_account_credentials, get_access_token, load_tracker, sign_rs256, b64url,
)

# Set this once, after creating and sharing the sheet (see docstring above).
SPREADSHEET_ID = os.environ.get("SEO_SHEET_ID", "")

SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"
TOKEN_URI = "https://oauth2.googleapis.com/token"
SHEETS_API = f"https://sheets.googleapis.com/v4/spreadsheets/{{spreadsheet_id}}"

RANKINGS_TAB = "Rankings"
CHANGES_TAB = "Changes"


def get_sheets_access_token(creds: dict) -> str:
    import time
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    claims = {
        "iss": creds["client_email"], "scope": SHEETS_SCOPE, "aud": TOKEN_URI,
        "iat": now, "exp": now + 3600,
    }
    signing_input = b64url(json.dumps(header).encode()) + "." + b64url(json.dumps(claims).encode())
    signature = sign_rs256(creds["private_key"], signing_input.encode())
    jwt = signing_input + "." + b64url(signature)
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": jwt,
    }).encode()
    req = urllib.request.Request(TOKEN_URI, data=body, method="POST",
                                  headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)["access_token"]


def sheets_request(token: str, path: str, method: str = "GET", body: dict = None) -> dict:
    url = SHEETS_API.format(spreadsheet_id=SPREADSHEET_ID) + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def ensure_tabs_exist(token: str) -> None:
    meta = sheets_request(token, "")
    existing = {s["properties"]["title"] for s in meta["sheets"]}
    requests = []
    for tab in (RANKINGS_TAB, CHANGES_TAB):
        if tab not in existing:
            requests.append({"addSheet": {"properties": {"title": tab}}})
    if requests:
        sheets_request(token, ":batchUpdate", method="POST", body={"requests": requests})


def build_rankings_grid(tracker: dict) -> list:
    queries = tracker.get("queries", {})
    # Collect every (run, date) pair that appears in any query's history, in order.
    run_labels = {}  # run_number -> "Run N (YYYY-MM-DD)"
    for entry in queries.values():
        for h in entry.get("history", []):
            run_labels.setdefault(h["run"], f"Run {h['run']} ({h['date']})")
    ordered_runs = sorted(run_labels.keys())

    header = ["Phrase", "Language", "Status"] + [run_labels[r] for r in ordered_runs]
    rows = [header]
    for q, entry in sorted(queries.items(), key=lambda kv: (kv[1].get("status", ""), kv[0])):
        history_by_run = {h["run"]: h["position"] for h in entry.get("history", [])}
        row = [q, entry.get("language", ""), entry.get("status", "")]
        for r in ordered_runs:
            pos = history_by_run.get(r)
            row.append(round(pos, 1) if pos is not None else "")
        rows.append(row)
    return rows


def build_changes_grid(tracker: dict) -> list:
    header = ["Run", "Date", "Query", "What changed", "Page", "PR link"]
    rows = [header]
    for c in tracker.get("changes_log", []):
        rows.append([c.get("run", ""), c.get("date", ""), c.get("query", ""),
                     c.get("description", ""), c.get("page", ""), c.get("pr_link") or ""])
    return rows


def write_grid(token: str, tab: str, grid: list) -> None:
    sheets_request(token, f"/values/{urllib.parse.quote(tab)}:clear", method="POST", body={})
    last_col = chr(ord("A") + max(len(row) for row in grid) - 1) if grid else "A"
    rng = f"{tab}!A1:{last_col}{len(grid)}"
    sheets_request(token, f"/values/{urllib.parse.quote(rng)}?valueInputOption=RAW", method="PUT",
                    body={"range": rng, "majorDimension": "ROWS", "values": grid})


def main():
    if not SPREADSHEET_ID:
        print("Set SEO_SHEET_ID (env var) to the target Google Sheet's ID — see this file's "
              "docstring for one-time setup steps.", file=sys.stderr)
        sys.exit(1)

    creds = load_service_account_credentials()
    token = get_sheets_access_token(creds)
    tracker = load_tracker()

    try:
        ensure_tabs_exist(token)
    except urllib.error.HTTPError as e:
        print(f"Could not access the sheet (HTTP {e.code}). Check it's shared with "
              f"{creds['client_email']} as Editor, and the Sheets API is enabled.", file=sys.stderr)
        raise

    write_grid(token, RANKINGS_TAB, build_rankings_grid(tracker))
    write_grid(token, CHANGES_TAB, build_changes_grid(tracker))
    print(f"Synced {len(tracker.get('queries', {}))} phrases and "
          f"{len(tracker.get('changes_log', []))} logged changes to "
          f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit")


if __name__ == "__main__":
    main()
