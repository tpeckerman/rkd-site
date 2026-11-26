#!/usr/bin/env python3
"""Find real search phrases rkdzichron.com has ZERO Search Console visibility
on yet — a different gap than seo/search_console_report.py, which can only
ever show queries the site already has at least one impression on.

Uses Google's public autocomplete endpoint (suggestqueries.google.com) —
the same underlying data source most commercial "keyword research" tools
are built on — seeded with a curated list of root phrases for this
business, in both languages. No API key, no third-party service, no cost.

New suggestions are added to seo/keyword_tracker.json with status
"candidate" (no real position data exists for them yet — that's the point).
If one later starts showing real impressions, the next
seo/search_console_report.py run will naturally update it to "targeting"
or "page1" based on its real position, since both scripts key off the
literal query string.

This doesn't need to run every single week like the Search Console report —
the root phrases and Google's suggestions don't change fast. Run it every
few weeks, or whenever you want to sanity-check for new angles.

Usage:
    python3 seo/keyword_expansion.py
"""
import json
import sys
import urllib.parse
import urllib.request

from search_console_report import load_tracker, save_tracker, is_hebrew

AUTOCOMPLETE_URL = "https://suggestqueries.google.com/complete/search"

# Root phrases to expand from, in both languages. Add to this over time —
# these were picked to cover the business's main angles (general activities,
# kids, family, birthday parties, arcade, and audience segments autocomplete
# itself surfaced, like couples/adults/team-building — see seo/SEO_LOG.md
# Run 5 for how this list grew).
ROOT_PHRASES = {
    "en": [
        "things to do in zichron yaakov",
        "zichron yaakov kids",
        "kids activities zichron yaakov",
        "zichron yaakov family",
        "zichron yaakov birthday",
        "zichron yaakov events",
        "arcade zichron",
    ],
    "he": [
        "פעילויות בזכרון יעקב",
        "דברים לעשות בזכרון יעקב",
        "מה לעשות עם ילדים בזכרון יעקב",
        "אטרקציות בזכרון יעקב ל",
        "משחקיה בזכרון יעקב",
        "ארקייד בזכרון יעקב",
        "יום הולדת בזכרון יעקב",
    ],
}

# Suggestions containing any of these are a different business entirely
# (hotels/restaurants/wine tourism dominate generic "Zichron Yaakov" autocomplete)
# — exclude them rather than treat them as opportunities.
OFF_TOPIC_SUBSTRINGS = [
    "מלון", "מסעדה", "יקב", "ספא", "צימר", "weather", "hotel", "restaurant",
    "winery", "wine", "spa",
]


def fetch_suggestions(query: str, lang: str) -> list[str]:
    hl = "iw" if lang == "he" else "en"
    url = f"{AUTOCOMPLETE_URL}?client=firefox&hl={hl}&q={urllib.parse.quote(query)}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.load(resp)
    return data[1] if len(data) > 1 else []


def is_on_topic(suggestion: str) -> bool:
    return not any(bad in suggestion for bad in OFF_TOPIC_SUBSTRINGS)


def main():
    tracker = load_tracker()
    queries = tracker.setdefault("queries", {})

    all_suggestions = {}
    for lang, roots in ROOT_PHRASES.items():
        for root in roots:
            try:
                suggestions = fetch_suggestions(root, lang)
            except Exception as e:
                print(f"  (failed to fetch suggestions for '{root}': {e})", file=sys.stderr)
                continue
            for s in suggestions:
                if is_on_topic(s):
                    all_suggestions[s] = lang

    new_candidates = []
    already_known = []
    for suggestion, lang in all_suggestions.items():
        if suggestion in queries:
            already_known.append(suggestion)
            continue
        queries[suggestion] = {
            "language": "he" if is_hebrew(suggestion) else lang,
            "status": "candidate",
            "source": "autocomplete_expansion",
            "first_position": None,
            "best_position": None,
            "current_position": None,
            "current_impressions": None,
        }
        new_candidates.append(suggestion)

    save_tracker(tracker)

    print(f"Fetched autocomplete suggestions for {sum(len(v) for v in ROOT_PHRASES.values())} root phrases.")
    print(f"\n-- NEW candidates added to the tracker ({len(new_candidates)}) --")
    for c in sorted(new_candidates):
        print(f"  '{c}'")
    print(f"\n-- Already tracked, no change ({len(already_known)}) --")
    for c in sorted(already_known):
        print(f"  '{c}'")
    print("\nThese are phrases Search Console doesn't show any impressions for yet — "
          "candidates for NEW content (a page, section, or FAQ entry), not fixes to "
          "existing pages. Pick 1-2 per run at most; most won't pan out, and that's fine.")


if __name__ == "__main__":
    main()
