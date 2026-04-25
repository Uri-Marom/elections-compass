#!/usr/bin/env python3
"""
Builds per-MK position data from Knesset shadow votes (Knessets 22–24).

Only questions with actual vote_ids in vote_mappings.json are scored —
currently q01, q06, q08, q13, q15, q16, q26, q28 (spanning 5 dimensions).
Adding more vote_id entries to vote_mappings.json will improve coverage.

Outputs:
  src/data/mks.json           — MK profiles (id, name, party, knessets)
  src/data/mk_positions.json  — per-MK per-question scores in [-2, +2]

Usage:
    python scripts/build_mk_data.py         # dry run — prints stats only
    python scripts/build_mk_data.py --write # write output files
"""

from __future__ import annotations
import csv, io, json, sys, urllib.request
from collections import defaultdict
from pathlib import Path
from statistics import mean
from typing import Optional

ROOT           = Path(__file__).parent.parent
MAPPINGS_FILE  = ROOT / "src" / "data" / "vote_mappings.json"
MKS_FILE       = ROOT / "src" / "data" / "mks.json"
POSITIONS_FILE = ROOT / "src" / "data" / "mk_positions.json"

SHADOW_CSV_URL   = "https://production.oknesset.org/pipelines/data/votes/vote_rslts_kmmbr_shadow/vote_rslts_kmmbr_shadow.csv"
MK_INDIVIDUAL_URL = "https://production.oknesset.org/pipelines/data/members/mk_individual/mk_individual.csv"
MK_FACTIONS_URL   = "https://production.oknesset.org/pipelines/data/members/mk_individual/mk_individual_factions.csv"

# Minimum questions an MK must have shadow-vote coverage on to be included.
# Currently 8 questions have vote_ids so MIN_QUESTIONS=4 retains MKs who
# were absent for roughly half — a reasonable threshold given sparse data.
MIN_QUESTIONS = 4

# Maps faction name (Hebrew) → our party_id.
# Used to assign party to MKs based on their most recent faction membership.
FACTION_NAME_MAP: dict[str, Optional[str]] = {
    # Active parties (25th Knesset)
    "הליכוד":              "likud",
    "ש\"ס":                "shas",
    "ש״ס":                 "shas",
    "יהדות התורה":         "utj",
    "עוצמה יהודית":        "otzma",
    "הציונות הדתית":       "religious_zionism",
    "יש עתיד":             "yesh_atid",
    "כחול לבן":            "national_unity",
    "ישראל ביתנו":         "yisrael_beitenu",
    "הדמוקרטים":           "democrats",
    'חד"ש-תע"ל':           "hadash_taal",
    "חד״ש-תע״ל":           "hadash_taal",
    'חד"ש':                "hadash_taal",
    'תע"ל':                "hadash_taal",
    "רע\"מ":               "raam",
    "רע״מ":                "raam",
    "מפלגת בנט":           "bennett_2026",
    "ישר!":                "yashar",
    "המילואימניקים":       "miluimnikim",
    # Historical / variant names (22nd–24th Knessets as they appear in shadow CSV)
    'יש עתיד - תל"ם':      "yesh_atid",
    "ימינה":               "religious_zionism",
    "הבית היהודי":         "religious_zionism",
    "תקווה חדשה":          "national_unity",
    "דרך ארץ":             "national_unity",
    "כחול לבן - המחנה הממלכתי": "national_unity",
    "עבודה":               "democrats",
    "העבודה":              "democrats",
    "העבודה הישראלית":     "democrats",
    "העבודה - מימד":       "democrats",
    "עבודה - מימד":        "democrats",
    "מרצ":                 "democrats",
    "גשר":                 "democrats",
    "עם חופשי":            "democrats",
    "העבודה-גשר-מרצ":     "democrats",   # 22nd Knesset combined list
    "הרשימה המשותפת":      "hadash_taal",   # joint Arab list
    "רשימה משותפת":        "hadash_taal",
    "הרשימה הערבית המאוחדת": "raam",
    "רשימה ערבית מאוחדת":  "raam",
    "עצמאית":              None,  # independent — skip
    "אחדות":               None,
}

FOR_CODE     = "1"
AGAINST_CODE = "2"
ABSTAIN_CODE = "3"


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

def fetch_csv(url: str, label: str) -> list[dict]:
    print(f"Downloading {label} ...", flush=True)
    with urllib.request.urlopen(url, timeout=120) as r:
        content = r.read().decode("utf-8", errors="replace")
    rows = list(csv.DictReader(io.StringIO(content)))
    if rows:
        print(f"  {len(rows):,} rows, columns: {list(rows[0].keys())}", flush=True)
    return rows


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def load_vote_ids(mappings: dict) -> dict[str, list[tuple[int, str]]]:
    """Returns {question_id: [(vote_id, direction), ...]} for questions with actual votes."""
    result = {}
    for qid, mapping in mappings.items():
        if qid.startswith("_"):
            continue
        votes = [(v["vote_id"], v["direction"]) for v in mapping.get("votes", [])]
        if votes:
            result[qid] = votes
    return result


def build_mk_vote_scores(
    shadow_rows: list[dict],
    vote_ids_by_question: dict[str, list[tuple[int, str]]],
) -> tuple[dict, dict, dict[str, set], dict[str, tuple[str, int]]]:
    """
    Single-pass over the shadow CSV:
    - scores MKs on survey questions from their actual votes
    - captures the most recent faction per MK (for party assignment)
    - captures Hebrew names

    Returns (mk_scores, mk_names, mk_knessets, mk_latest_faction)
    where mk_latest_faction[mk_id] = (faction_name, knesset_num)
    """
    all_relevant_vote_ids: set[str] = set()
    direction_by_vote: dict[str, str] = {}
    for qid, vid_dirs in vote_ids_by_question.items():
        for vid, direction in vid_dirs:
            all_relevant_vote_ids.add(str(vid))
            direction_by_vote[str(vid)] = direction

    mk_vote_raw: dict[str, dict[str, float]] = defaultdict(dict)
    mk_knessets: dict[str, set[int]] = defaultdict(set)
    mk_names: dict[str, str] = {}
    mk_latest_faction: dict[str, tuple[str, int]] = {}  # mk_id → (faction_name, knesset_num)

    for row in shadow_rows:
        mk_id  = row.get("kmmbr_id", "").strip()
        if not mk_id:
            continue

        name = row.get("kmmbr_name", "").strip()
        if name:
            mk_names[mk_id] = name

        faction_name = row.get("faction_name", "").strip()
        try:
            kn = int(row.get("knesset_num", 0))
        except (ValueError, TypeError):
            kn = 0

        if faction_name and kn:
            existing = mk_latest_faction.get(mk_id)
            if existing is None or kn > existing[1]:
                mk_latest_faction[mk_id] = (faction_name, kn)
            mk_knessets[mk_id].add(kn)

        vid = row.get("vote_id", "")
        if vid not in all_relevant_vote_ids:
            continue

        result = row.get("vote_result", "").strip()
        if result not in (FOR_CODE, AGAINST_CODE, ABSTAIN_CODE):
            continue

        raw = 2.0 if result == FOR_CODE else (-2.0 if result == AGAINST_CODE else 0.0)
        direction = direction_by_vote.get(vid, "for_means_agree")
        if direction == "against_means_agree":
            raw = -raw

        mk_vote_raw[mk_id][vid] = raw

    # Aggregate per-MK per-question
    mk_scores: dict[str, dict[str, float]] = {}
    for mk_id, vote_raw in mk_vote_raw.items():
        q_scores: dict[str, float] = {}
        for qid, vid_dirs in vote_ids_by_question.items():
            values = [vote_raw[str(vid)] for vid, _ in vid_dirs if str(vid) in vote_raw]
            if values:
                q_scores[qid] = round(mean(values), 2)
        if q_scores:
            mk_scores[mk_id] = q_scores

    return mk_scores, mk_names, mk_knessets, mk_latest_faction


def build_mk_name_lookup(individual_rows: list[dict]) -> dict[str, tuple[str, str, bool]]:
    """
    Returns {person_id: (name_he, name_en, is_current)} from the individual CSV.
    PersonID in that CSV matches kmmbr_id in the shadow CSV.
    """
    if not individual_rows:
        return {}
    sample = individual_rows[0]
    cols = set(sample.keys())

    def col(*candidates: str) -> Optional[str]:
        for c in candidates:
            if c in cols:
                return c
        return None

    person_id_col = col("PersonID", "person_id")
    name_col      = col("mk_individual_name", "mk_name", "Name", "name_he")
    name_en_col   = col("mk_individual_name_eng", "mk_name_eng", "NameEng", "name_en")
    first_he_col  = col("mk_individual_first_name")
    first_en_col  = col("mk_individual_first_name_eng")
    last_col      = col("LastName")
    current_col   = col("IsCurrent", "is_current", "current", "active")

    print(
        f"  Individual CSV: PersonID={person_id_col} name_he={name_col} "
        f"name_en={name_en_col} current={current_col}",
        flush=True,
    )

    result: dict[str, tuple[str, str, bool]] = {}
    for row in individual_rows:
        pid = row.get(person_id_col or "", "").strip() if person_id_col else ""
        if not pid:
            continue

        # Hebrew full name: prefer first+last, fall back to full name field
        name_he = ""
        if first_he_col and last_col:
            first = row.get(first_he_col, "").strip()
            last  = row.get(last_col, "").strip()
            name_he = f"{first} {last}".strip()
        if not name_he and name_col:
            name_he = row.get(name_col, "").strip()

        # English name
        name_en = ""
        if name_en_col:
            name_en = row.get(name_en_col, "").strip()
        if not name_en and first_en_col:
            name_en = row.get(first_en_col, "").strip()

        is_current_raw = (row.get(current_col, "") if current_col else "").strip().lower()
        is_current = is_current_raw in ("true", "1", "yes", "t")

        result[pid] = (name_he, name_en, is_current)

    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    write_mode = "--write" in sys.argv

    with open(MAPPINGS_FILE) as f:
        mappings = json.load(f)

    vote_ids_by_question = load_vote_ids(mappings)
    print(f"\nQuestions with shadow-CSV vote data: {sorted(vote_ids_by_question.keys())}")
    all_vote_ids = {str(vid) for vids in vote_ids_by_question.values() for vid, _ in vids}
    print(f"Total distinct vote_ids to scan: {len(all_vote_ids)}\n")

    shadow_rows     = fetch_csv(SHADOW_CSV_URL,    "shadow votes CSV")
    individual_rows = fetch_csv(MK_INDIVIDUAL_URL, "MK individual CSV")

    print("\nScoring MKs from shadow votes (single pass)...")
    mk_scores, mk_names_shadow, mk_knessets, mk_latest_faction = build_mk_vote_scores(
        shadow_rows, vote_ids_by_question
    )
    print(f"  {len(mk_scores):,} MKs with at least 1 scored question before filtering.")
    mk_scores_filtered = {
        mk_id: scores
        for mk_id, scores in mk_scores.items()
        if len(scores) >= MIN_QUESTIONS
    }
    print(f"  {len(mk_scores_filtered):,} MKs with ≥{MIN_QUESTIONS} scored questions.")

    print("\nLoading MK name data...")
    name_lookup = build_mk_name_lookup(individual_rows)
    print(f"  {len(name_lookup):,} profiles loaded (keyed by PersonID).")

    # Debug: show which faction names appear for our scored MKs and their mapping
    faction_name_counts: dict[str, int] = defaultdict(int)
    unmapped_factions: set[str] = set()
    for mk_id in mk_scores_filtered:
        faction_info = mk_latest_faction.get(mk_id)
        fname = faction_info[0] if faction_info else ""
        faction_name_counts[fname] += 1
        if fname and FACTION_NAME_MAP.get(fname) is None and fname not in FACTION_NAME_MAP:
            unmapped_factions.add(fname)

    if unmapped_factions:
        print(f"\n  WARNING: unmapped faction names (MKs will be skipped): {unmapped_factions}", flush=True)

    # Build output
    mks_out: list[dict] = []
    positions_out: dict[str, dict[str, float]] = {}
    skipped_unknown_party = 0

    for mk_id, scores in mk_scores_filtered.items():
        faction_info = mk_latest_faction.get(mk_id)
        faction_name = faction_info[0] if faction_info else ""
        party_id = FACTION_NAME_MAP.get(faction_name)
        if party_id is None:
            skipped_unknown_party += 1
            continue

        # Name from individual CSV.
        # PersonID in individual CSV is numeric (e.g. "965") while kmmbr_id in shadow CSV is
        # zero-padded (e.g. "000000965"), so we try both forms.
        name_data = name_lookup.get(mk_id) or name_lookup.get(str(int(mk_id)))
        name_he   = name_data[0] if name_data else mk_names_shadow.get(mk_id, "")
        name_en   = name_data[1] if name_data else ""
        is_current = name_data[2] if name_data else False

        knessets = sorted(mk_knessets.get(mk_id, set()))

        mks_out.append({
            "id":         mk_id,
            "name_he":    name_he,
            "name_en":    name_en,
            "party_id":   party_id,
            "knessets":   knessets,
            "is_current": is_current,
        })
        positions_out[mk_id] = scores

    print(f"\nFinal output: {len(mks_out)} MKs")
    print(f"  Skipped — unknown/unmapped party: {skipped_unknown_party}")

    # Party distribution
    party_counts: dict[str, int] = defaultdict(int)
    for mk in mks_out:
        party_counts[mk["party_id"]] += 1
    print("\nMKs per party:")
    for pid, count in sorted(party_counts.items(), key=lambda x: -x[1]):
        print(f"  {pid:<25} {count}")

    # Question coverage
    print("\nQuestion coverage (MKs with a score for each question):")
    for qid in sorted(vote_ids_by_question.keys()):
        covered = sum(1 for scores in positions_out.values() if qid in scores)
        print(f"  {qid}: {covered}/{len(positions_out)}")

    if not write_mode:
        print("\nDry run — pass --write to create src/data/mks.json and src/data/mk_positions.json.")
        return

    mks_out.sort(key=lambda m: m["name_he"])

    with open(MKS_FILE, "w") as f:
        json.dump(mks_out, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {MKS_FILE} ({len(mks_out)} MKs).")

    with open(POSITIONS_FILE, "w") as f:
        json.dump(positions_out, f, ensure_ascii=False, indent=2)
    print(f"Wrote {POSITIONS_FILE} ({len(positions_out)} entries).")


if __name__ == "__main__":
    main()
