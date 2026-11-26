#!/usr/bin/env python3
"""Pull real Search Console performance data for rkdzichron.com.

Auth: a Google service-account JSON key, signed into a JWT and exchanged for
an OAuth2 access token. Uses `openssl` for RSA signing instead of the
google-auth/cryptography Python stack, which has a broken cffi/cryptography
install in this environment.

The service account must be added as a user (Restricted is enough) on the
Search Console property at https://search.google.com/search-console
(Settings -> Users and permissions).

Usage:
    GOOGLE_SA_KEY_FILE=/path/to/key.json python3 seo/search_console_report.py

The key file path is read from an environment variable — never hardcode a
path to a real key file in this script, and never commit a key file to this
repo (it's public).
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
import urllib.parse

SITE_URL = "sc-domain:rkdzichron.com"
SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
TOKEN_URI = "https://oauth2.googleapis.com/token"
API_URL = f"https://www.googleapis.com/webmasters/v3/sites/{urllib.parse.quote(SITE_URL, safe='')}/searchAnalytics/query"

TARGET_QUERIES_SUBSTRINGS = [
    "things to do", "family", "kids", "birthday", "arcade",
    "אטרקציות", "פעילויות", "ילדים", "משפחה", "יום הולדת", "ארקייד", "zichron", "זכרון",
]


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


def get_access_token(key_file: str) -> str:
    with open(key_file, encoding="utf-8") as f:
        creds = json.load(f)

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


def main():
    key_file = os.environ.get("GOOGLE_SA_KEY_FILE", DEFAULT_KEY_FILE)
    if not os.path.exists(key_file):
        print(f"No key file found at {key_file}.", file=sys.stderr)
        print("Set GOOGLE_SA_KEY_FILE to the path of the service account JSON key, "
              f"or place it at {DEFAULT_KEY_FILE}.", file=sys.stderr)
        sys.exit(1)

    token = get_access_token(key_file)

    print(f"=== Search Console performance for {SITE_URL}, last 90 days ===\n")

    by_query = query_search_analytics(token, dimensions=("query",))
    rows = by_query.get("rows", [])
    if not rows:
        print("No query data returned at all — property may be too new, or no impressions yet.")
    else:
        print(f"Total distinct queries with impressions: {len(rows)}\n")
        relevant = [r for r in rows if any(s.lower() in r["keys"][0].lower() for s in TARGET_QUERIES_SUBSTRINGS)]
        print(f"-- Queries matching our target topics ({len(relevant)} of {len(rows)}) --")
        for r in sorted(relevant, key=lambda r: -r["impressions"]):
            print(f"  '{r['keys'][0]}'  clicks={r['clicks']}  impressions={r['impressions']}  "
                  f"ctr={r['ctr']:.1%}  avg_position={r['position']:.1f}")
        print("\n-- Top 20 queries overall (by impressions) --")
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
