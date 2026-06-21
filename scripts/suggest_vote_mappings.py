#!/usr/bin/env python3
"""
Fetches K25 Knesset plenary vote records from oknesset.org and searches for
candidates to add to vote_mappings.json.

For each question, it matches vote titles using Hebrew keywords.
Output is a human-readable report ONLY — no files are modified.
Review the suggestions and manually add relevant votes to vote_mappings.json
with the correct direction (for_means_agree / against_means_agree).

Usage:
    python scripts/suggest_vote_mappings.py
    python scripts/suggest_vote_mappings.py --question=q07
    python scripts/suggest_vote_mappings.py --since=2025-01-01
    python scripts/suggest_vote_mappings.py --all-questions   # include well-covered ones
"""

import csv
import io
import json
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path
from typing import Optional

ROOT          = Path(__file__).parent.parent
MAPPINGS_FILE = ROOT / "src" / "data" / "vote_mappings.json"

# kns_plenumvote.csv: vote header records with Id, VoteTitle, VoteDateTime.
# Id matches vote_id in vote_mappings.json and in the shadow CSV.
PLENARY_VOTE_URL = "https://production.oknesset.org/pipelines/data/knesset/kns_plenumvote/kns_plenumvote.csv"

# Per-question Hebrew keywords.
# A vote matches if ANY keyword is a substring of VoteTitle or VoteSubject.
QUESTION_KEYWORDS: dict[str, list[str]] = {
    "q01": ["התנחלויות", "גדה המערבית"],
    "q02": ["מדינה פלסטינית", "הכרה במדינה", "שתי מדינות"],
    "q03": ["עזה", "חמאס", "הפסקת אש", "חטופים"],
    "q04": ["ירושלים", "ריבונות"],
    "q05": ["זכות שיבה", "פליטים פלסטינים"],
    "q06": ["סיפוח", "ספח"],
    "q07": ["גיוס חרדים", "שירות חרדים", "נשיאה שווה בנטל", "חוק גיוס"],
    "q08": ["נישואין אזרחיים", "נישואים אזרחיים"],
    "q09": ["מסחר בשבת", "עסקים בשבת", "חוק שבת"],
    "q10": ["כותל", "נשות הכותל"],
    "q11": ["ישיבות", "מוסדות תורניים", "תקצוב ישיבות"],
    "q12": ["כשרות", "חוק כשרות"],
    "q13": ["קופות חולים", "תקציב בריאות", "מערכת הבריאות"],
    "q14": ["דיור ציבורי", "שיכון ציבורי"],
    "q15": ["שכר מינימום"],
    "q16": ["הפרטה", "חברות ממשלתיות"],
    "q17": ["תחרות חופשית", "ריכוזיות"],
    "q18": ["פסקת התגברות", "ביקורת שיפוטית על חקיקה"],
    "q19": ["ועדת המינויים", "מינוי שופטים", "בחירת שופטים"],
    "q20": ["יועץ משפטי", "יועמש"],
    "q21": ["עילת הסבירות", "ביטול עילת הסבירות"],
    "q22": ["עצמאות שיפוטית", "שלטון החוק"],
    "q23": ["חוק יסוד: כבוד האדם", "זכות שוויון", "איסור אפליה"],
    "q24": ["קואליציה ערבית", "שותפות ערבית", "מפלגות ערביות"],
    "q25": ["תקצוב ערבי", "רשויות ערביות", "מגזר ערבי"],
    "q26": ["חוק הלאום"],
    "q27": ["ראש ממשלה בכהונה", "כהונה בעת כתב אישום", "אי-כשירות ראש ממשלה"],
    "q28": ["הגבלת כהונה", "כהונת ראש ממשלה"],
    "q29": ["אחוז החסימה", "סף הכניסה"],
    "q30": ["מימון מפלגות", "תרומות"],
    "q31": ["ועדת חקירה", "7 באוקטובר", "שמחת תורה", "מחדל"],
    "q32": ["תכנית ליבה", "מוסדות פטור", "לימודי ליבה", "חינוך עצמאי"],
    "q33": ["תקשורת", "ממונה על שידורים", "רשות שידור"],
}


def load_already_mapped() -> set[int]:
    with open(MAPPINGS_FILE) as f:
        mappings = json.load(f)
    mapped: set[int] = set()
    for qid, m in mappings.items():
        if qid.startswith("_"):
            continue
        for v in m.get("votes", []):
            mapped.add(int(v["vote_id"]))
    return mapped


def parse_date(raw: str) -> Optional[date]:
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw[:19], fmt).date()
        except (ValueError, AttributeError):
            pass
    return None


def fetch_plenary_votes(since: Optional[date]) -> list[dict]:
    """
    Downloads kns_plenumvote.csv and returns a list of vote records.
    Each dict has: vote_id (int), date (date|None), title (str), subject (str).
    """
    print(f"Downloading Knesset plenary vote records (~8 MB)...", flush=True)
    with urllib.request.urlopen(PLENARY_VOTE_URL, timeout=60) as r:
        content = r.read().decode("utf-8", errors="replace")

    rows = list(csv.DictReader(io.StringIO(content)))
    print(f"  {len(rows):,} total vote records", flush=True)

    votes = []
    for row in rows:
        vid_raw = row.get("Id", "").strip()
        try:
            vid = int(vid_raw)
        except ValueError:
            continue

        vote_date = parse_date(row.get("VoteDateTime", ""))
        if since and (vote_date is None or vote_date < since):
            continue

        title   = (row.get("VoteTitle") or "").strip()
        subject = (row.get("VoteSubject") or "").strip()
        votes.append({
            "vote_id": vid,
            "date":    vote_date,
            "title":   title,
            "subject": subject,
        })

    return votes


def matches_question(vote: dict, qid: str) -> bool:
    keywords = QUESTION_KEYWORDS.get(qid, [])
    haystack = vote["title"] + " " + vote["subject"]
    return any(kw in haystack for kw in keywords)


def main() -> None:
    args = sys.argv[1:]
    only_question: Optional[str] = None
    since: Optional[date] = None
    show_all = "--all-questions" in args

    for arg in args:
        if arg.startswith("--question="):
            only_question = arg.split("=", 1)[1].strip()
        elif arg.startswith("--since="):
            try:
                since = date.fromisoformat(arg.split("=", 1)[1].strip())
            except ValueError:
                sys.exit(f"ERROR: invalid --since date: {arg}")
        elif arg == "--all-questions":
            pass  # handled above
        else:
            print(f"WARNING: unknown argument '{arg}' — ignoring.", flush=True)

    with open(MAPPINGS_FILE) as f:
        mappings = json.load(f)

    already_mapped = load_already_mapped()
    print(f"Already mapped vote IDs: {len(already_mapped)}", flush=True)

    try:
        votes = fetch_plenary_votes(since)
    except Exception as e:
        print(f"\nERROR fetching vote records: {e}", flush=True)
        print("Check network connectivity and try again.")
        sys.exit(1)

    unmapped = [v for v in votes if v["vote_id"] not in already_mapped]
    if since:
        print(f"  {len(unmapped):,} unmapped votes since {since}", flush=True)
    else:
        print(f"  {len(unmapped):,} unmapped (not yet in vote_mappings.json)", flush=True)

    print("\n" + "=" * 70)
    print("VOTE MAPPING CANDIDATES")
    print("=" * 70)
    print("Review these and add relevant ones to vote_mappings.json.")
    print("For each: set direction = for_means_agree or against_means_agree,")
    print("knesset = 25, and add a descriptive note.")
    print("=" * 70)

    any_found = False
    questions_to_check = [only_question] if only_question else list(mappings.keys())

    for qid in questions_to_check:
        if qid.startswith("_"):
            continue
        mapping = mappings.get(qid, {})
        current_k25 = [v for v in mapping.get("votes", []) if v.get("knesset") == 25]

        if not show_all and len(current_k25) >= 3:
            continue  # already well-covered; skip unless --all-questions

        matches = [v for v in unmapped if matches_question(v, qid)]
        if not matches:
            continue

        any_found = True
        desc = mapping.get("description", qid)
        coverage = f"{len(current_k25)} K25 vote(s) already mapped"
        print(f"\n[{qid}] {desc}  ({coverage})")
        print("-" * 60)
        for m in matches[:10]:
            date_str = m["date"].isoformat() if m["date"] else "?"
            print(f"  VoteID {m['vote_id']:>6}  {date_str}  {m['title'][:65]}")
            if m["subject"]:
                print(f"         {' ':6}              {m['subject'][:65]}")
        if len(matches) > 10:
            print(f"  ... and {len(matches) - 10} more — narrow with --since or --question")

    if not any_found:
        if only_question:
            print(f"\nNo unmapped candidates found for {only_question}.")
        else:
            print("\nNo unmapped candidate votes found.")
        if not show_all:
            print("(Questions with ≥3 K25 votes already mapped are skipped.")
            print(" Use --all-questions to include them.)")

    print("\n" + "=" * 70)
    print("To add a vote to vote_mappings.json:")
    print('  "votes": [ { "vote_id": <ID>, "knesset": 25,')
    print('               "direction": "for_means_agree",')
    print('               "note": "K25 <YYYY-MM-DD> — <description>" } ]')
    print("=" * 70)


if __name__ == "__main__":
    main()
