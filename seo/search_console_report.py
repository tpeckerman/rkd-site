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
