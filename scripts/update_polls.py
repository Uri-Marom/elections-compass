#!/usr/bin/env python3
"""
Fetches Israeli election polls from themadad.com/allpolls/, computes a
rolling 30-day median per party, and writes poll_seats to parties.json.

Usage:
    python scripts/update_polls.py            # dry run — prints results only
    python scripts/update_polls.py --write    # updates src/data/parties.json

Column mapping is verified against the confirmed table structure from
themadad.com (April 2026). If the site changes its columns, the script
will warn about unknown headers rather than silently mismap them.
"""

import json
import subprocess
import sys
from datetime import date, timedelta
from html.parser import HTMLParser
from pathlib import Path
from statistics import median
from typing import Dict, List, Optional, Tuple

ROOT         = Path(__file__).parent.parent
PARTIES_FILE = ROOT / "src" / "data" / "parties.json"
POLLS_URL    = "https://themadad.com/allpolls/"
WINDOW_DAYS  = 30

# Channel 14 (ערוץ 14) is excluded: it is a right-leaning outlet whose
# polls consistently show Likud ~10 seats higher than every other pollster,
# making it a systematic outlier rather than sampling noise.
EXCLUDE_SOURCES = {"ערוץ 14"}

# Maps Hebrew column header → our party_id (None = not tracked)
# Hebrew quotation marks (״) and ASCII (") variants are both listed
# because the site uses different encodings for different parties.
COLUMN_MAP: Dict[str, Optional[str]] = {
    "הליכוד":              "likud",
    "יהדות התורה":         "utj",
    "ש״ס":                 "shas",
    'ש"ס':                 "shas",
    "כחול לבן":            "national_unity",
    "יש עתיד":             "yesh_atid",
    "חדש תע״ל":            "hadash_taal",
    'חדש תע"ל':            "hadash_taal",
    "ישראל ביתנו":         "yisrael_beitenu",
    "הדמוקרטים":           "democrats",
    "הציונות הדתית":       "religious_zionism",
    "רע״מ":                "raam",
    'רע"מ':                "raam",
    "בל״ד":                None,  # Balad — not tracked
    'בל"ד':                None,
    "עוצמה יהודית":        "otzma",
    "מפלגת בנט":           "bennett_2026",
    "ישר!":                "yashar",
    "המילואימניקים":       "miluimnikim",
    "רשימה ערבית מאוחדת":  None,  # combined Arab list — not tracked
    "‏רשימה ערבית מאוחדת": None,  # same with RTL mark the site sometimes emits
    # Source/pollster names that leak into the header row due to HTML structure
    "מעריב":       None,
    "מנחם לזר":    None,
}

# Metadata columns that appear before party data
# (poll#, date, respondents, source, pollster)
META_COLS = 5

SANITY_TOTAL_MIN = 100
SANITY_TOTAL_MAX = 145
SANITY_MAX_PARTY =  50
SANITY_MIN_POLLS  =   3


# ---------------------------------------------------------------------------
# HTML parsing
# ---------------------------------------------------------------------------

class TableParser(HTMLParser):
    """Extracts all rows from the first <table> as lists of cell text."""

    def __init__(self):
        super().__init__()
        self.rows: list[list[str]] = []
        self._depth = 0
        self._in_cell = False
        self._cell: list[str] = []
        self._row: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self._depth += 1
        if self._depth and tag in ("td", "th"):
            self._in_cell = True
            self._cell = []

    def handle_endtag(self, tag):
        if tag == "table":
            self._depth -= 1
        if tag in ("td", "th") and self._in_cell:
            self._in_cell = False
            self._row.append("".join(self._cell).strip())
        if tag == "tr" and self._row:
            self.rows.append(self._row)
            self._row = []

    def handle_data(self, data):
        if self._in_cell:
            self._cell.append(data)

    def handle_entityref(self, name):
        if self._in_cell:
            self._cell.append(
                {"amp": "&", "lt": "<", "gt": ">", "nbsp": " ", "quot": '"'}.get(name, "")
            )

    def handle_charref(self, name):
        if self._in_cell:
            try:
                c = chr(int(name[1:], 16) if name.startswith("x") else int(name))
                self._cell.append(c)
            except (ValueError, OverflowError):
                pass


def fetch_table_rows(url: str) -> List[List[str]]:
    print(f"Fetching {url} ...", flush=True)
    # Use curl to handle Cloudflare cookies/redirects that trip up urllib
    result = subprocess.run(
        ["curl", "-s", "--max-time", "30", url],
        capture_output=True, timeout=40,
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl failed (exit {result.returncode}): {result.stderr.decode()}")
    html = result.stdout.decode("utf-8", errors="replace")
    parser = TableParser()
    parser.feed(html)
    print(f"  Found {len(parser.rows)} table rows.", flush=True)
    return parser.rows


# ---------------------------------------------------------------------------
# Parsing logic
# ---------------------------------------------------------------------------

def find_header_row(rows: List[List[str]]) -> Tuple[int, List[Optional[str]]]:
    """
    Returns (row_index, party_id_per_column) where party_id_per_column[i]
    is the party_id for column META_COLS+i, or None if not tracked.
    Raises if no header row found.
    """
    for i, row in enumerate(rows):
        if len(row) > META_COLS and any(col in COLUMN_MAP for col in row[META_COLS:]):
            party_cols: List[Optional[str]] = []
            unknown: list[str] = []
            for header in row[META_COLS:]:
                if header in COLUMN_MAP:
                    party_cols.append(COLUMN_MAP[header])
                else:
                    party_cols.append(None)
                    # Only warn about cells that look like Hebrew text,
                    # not numbers/dates that spill in from the first data row
                    if header and any("֐" <= c <= "׿" for c in header):
                        unknown.append(header)
            if unknown:
                print(f"  WARNING: unrecognised columns (not mapped): {unknown}", flush=True)
            return i, party_cols
    raise ValueError("Could not find the polls header row — site structure may have changed.")


def parse_polls(rows: List[List[str]], header_idx: int, party_cols: List[Optional[str]]) -> List[dict]:
    """
    Returns a list of poll dicts:
      { "date": date, "source": str, "seats": { party_id: int } }
    Only polls within WINDOW_DAYS of today are included.
    """
    cutoff = date.today() - timedelta(days=WINDOW_DAYS)
    polls = []

    for row in rows[header_idx + 1:]:
        if len(row) < META_COLS + 1:
            continue

        # Date is column index 1 (format YYYY-MM-DD)
        try:
            poll_date = date.fromisoformat(row[1].strip())
        except ValueError:
            continue  # skip non-data rows

        if poll_date < cutoff:
            continue

        source = row[3].strip()
        if source in EXCLUDE_SOURCES:
            continue

        seats: dict[str, int] = {}
        party_data = row[META_COLS:]
        for i, party_id in enumerate(party_cols):
            if party_id is None or i >= len(party_data):
                continue
            try:
                val = int(party_data[i].strip())
                seats[party_id] = val
            except ValueError:
                pass  # cell is empty or non-numeric

        if not seats:
            continue

        # Sanity-check this individual poll
        total = sum(seats.values())
        if not (SANITY_TOTAL_MIN <= total <= SANITY_TOTAL_MAX):
            print(
                f"  SKIP poll {row[0]} ({poll_date}, {source}): "
                f"total seats {total} outside [{SANITY_TOTAL_MIN}–{SANITY_TOTAL_MAX}]",
                flush=True,
            )
            continue
        if any(v > SANITY_MAX_PARTY for v in seats.values()):
            worst = max(seats, key=seats.get)  # type: ignore[arg-type]
            print(
                f"  SKIP poll {row[0]} ({poll_date}, {source}): "
                f"{worst}={seats[worst]} exceeds max {SANITY_MAX_PARTY}",
                flush=True,
            )
            continue

        polls.append({"date": poll_date, "source": source, "seats": seats})

    return polls


def compute_medians(polls: List[dict]) -> Dict[str, int]:
    """Returns median seat count per party, rounded to nearest int."""
    by_party: Dict[str, List[int]] = {}
    for poll in polls:
        for party_id, seats in poll["seats"].items():
            by_party.setdefault(party_id, []).append(seats)
    return {pid: round(median(vals)) for pid, vals in by_party.items()}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    write_mode = "--write" in sys.argv

    try:
        rows = fetch_table_rows(POLLS_URL)
    except Exception as e:
        sys.exit(f"ERROR fetching polls: {e}")

    try:
        header_idx, party_cols = find_header_row(rows)
    except ValueError as e:
        sys.exit(f"ERROR: {e}")

    polls = parse_polls(rows, header_idx, party_cols)

    if len(polls) < SANITY_MIN_POLLS:
        sys.exit(
            f"ERROR: only {len(polls)} valid polls found in the last {WINDOW_DAYS} days "
            f"(need at least {SANITY_MIN_POLLS}). Check date range or site structure."
        )

    print(f"\nUsing {len(polls)} polls from {min(p['date'] for p in polls)} "
          f"to {max(p['date'] for p in polls)}:")
    for p in polls:
        print(f"  {p['date']}  {p['source']}")

    medians = compute_medians(polls)

    print(f"\nMedian seat projections (last {WINDOW_DAYS} days, excluding {EXCLUDE_SOURCES}):")
    for party_id, seats in sorted(medians.items(), key=lambda x: -x[1]):
        print(f"  {party_id:<25} {seats}")

    if not write_mode:
        print("\nDry run — pass --write to update parties.json.")
        return

    with open(PARTIES_FILE) as f:
        parties = json.load(f)

    updated = 0
    for party in parties:
        pid = party["id"]
        if pid in medians:
            old = party.get("poll_seats")
            party["poll_seats"] = medians[pid]
            if old != medians[pid]:
                print(f"  {pid}: {old} → {medians[pid]}")
                updated += 1

    with open(PARTIES_FILE, "w") as f:
        json.dump(parties, f, ensure_ascii=False, indent=2)

    print(f"\nWrote {PARTIES_FILE} ({updated} parties changed).")


if __name__ == "__main__":
    main()
