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
import csv, io, json, sys, time, urllib.request, urllib.parse
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


ATTENDANCE_KNESSETS = {22, 23, 24}  # knessets covered by the shadow CSV

def build_mk_vote_scores(
    shadow_rows: list[dict],
    vote_ids_by_question: dict[str, list[tuple[int, str]]],
) -> tuple[dict, dict, dict[str, set], dict[str, tuple[str, int]], dict[str, float]]:
    """
    Single-pass over the shadow CSV. Returns:
      mk_scores, mk_names, mk_knessets, mk_latest_faction, mk_attendance_rate

    Attendance rate = fraction of all votes (in ATTENDANCE_KNESSETS) that the
    MK actually cast a vote in, scoped to the knessets they were active in.
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
    mk_latest_faction: dict[str, tuple[str, int]] = {}

    # For attendance: track unique vote_ids per knesset (global) and per MK
    total_votes_per_knesset: dict[int, set[str]] = defaultdict(set)
    mk_votes_per_knesset: dict[str, dict[int, set[str]]] = defaultdict(lambda: defaultdict(set))

    for row in shadow_rows:
        mk_id  = row.get("kmmbr_id", "").strip()
        if not mk_id:
            continue

        name = row.get("kmmbr_name", "").strip()
        if name:
            mk_names[mk_id] = name

        faction_name = row.get("faction_name", "").strip()
        vid = row.get("vote_id", "").strip()
        try:
            kn = int(row.get("knesset_num", 0))
        except (ValueError, TypeError):
            kn = 0

        if faction_name and kn:
            existing = mk_latest_faction.get(mk_id)
            if existing is None or kn > existing[1]:
                mk_latest_faction[mk_id] = (faction_name, kn)
            mk_knessets[mk_id].add(kn)

        # Attendance tracking (all votes in covered knessets)
        if kn in ATTENDANCE_KNESSETS and vid:
            total_votes_per_knesset[kn].add(vid)
            result_code = row.get("vote_result", "").strip()
            if result_code in (FOR_CODE, AGAINST_CODE, ABSTAIN_CODE):
                mk_votes_per_knesset[mk_id][kn].add(vid)

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

    # Aggregate per-MK per-question scores
    mk_scores: dict[str, dict[str, float]] = {}
    for mk_id, vote_raw in mk_vote_raw.items():
        q_scores: dict[str, float] = {}
        for qid, vid_dirs in vote_ids_by_question.items():
            values = [vote_raw[str(vid)] for vid, _ in vid_dirs if str(vid) in vote_raw]
            if values:
                q_scores[qid] = round(mean(values), 2)
        if q_scores:
            mk_scores[mk_id] = q_scores

    # Compute attendance rate per MK
    mk_attendance: dict[str, float] = {}
    for mk_id, kn_votes in mk_votes_per_knesset.items():
        # Only count knessets in ATTENDANCE_KNESSETS where the MK was active
        active_kns = mk_knessets[mk_id] & ATTENDANCE_KNESSETS
        if not active_kns:
            continue
        mk_participated = sum(len(kn_votes.get(kn, set())) for kn in active_kns)
        total_possible  = sum(len(total_votes_per_knesset[kn]) for kn in active_kns)
        if total_possible > 0:
            mk_attendance[mk_id] = round(mk_participated / total_possible, 4)

    print(f"  Total unique votes in knessets 22-24: "
          f"{sum(len(v) for v in total_votes_per_knesset.values()):,}", flush=True)

    return mk_scores, mk_names, mk_knessets, mk_latest_faction, mk_attendance


ODATA_BILL_URL = "https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_BillInitiator"

def fetch_mk_bill_counts(person_ids: list[str], batch_size: int = 20) -> dict[str, int]:
    """
    Returns {person_id_str: bill_count} by querying OData in batches.
    person_ids are the non-padded PersonID strings (e.g. "965").
    """
    counts: dict[str, int] = {pid: 0 for pid in person_ids}
    total = len(person_ids)

    for start in range(0, total, batch_size):
        batch = person_ids[start: start + batch_size]
        filter_expr = " or ".join(f"PersonID eq {pid}" for pid in batch)
        params = urllib.parse.urlencode({
            "$filter": filter_expr,
            "$select": "PersonID",
            "$format": "json",
            "$top": 5000,
        })
        url = f"{ODATA_BILL_URL}?{params}"
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
            for record in data.get("value", []):
                pid = str(record.get("PersonID", ""))
                if pid in counts:
                    counts[pid] += 1
        except Exception as e:
            print(f"  WARNING: bill fetch failed for batch starting {batch[0]}: {e}", flush=True)

        if start + batch_size < total:
            time.sleep(0.3)  # be polite to the API

        done = min(start + batch_size, total)
        print(f"  Bills: {done}/{total} MKs fetched...", end="\r", flush=True)

    print(f"  Bills: {total}/{total} MKs fetched.    ", flush=True)
    return counts


def compute_activity_grades(
    mk_ids: list[str],
    attendance: dict[str, float],
    bill_counts: dict[str, int],
) -> dict[str, dict]:
    """
    Returns {mk_id: {attendance_pct, bill_count, activity_score, activity_grade}}
    Grades are percentile-based within the cohort.
    """
    att_vals  = [attendance.get(mk, 0.0) for mk in mk_ids]
    bill_vals = [bill_counts.get(mk, 0)   for mk in mk_ids]

    def percentile_rank(vals: list, v: float) -> float:
        """Return what fraction of values v beats (0–1)."""
        below = sum(1 for x in vals if x < v)
        equal = sum(1 for x in vals if x == v)
        return (below + equal / 2) / len(vals) if vals else 0.5

    results: dict[str, dict] = {}
    for mk_id in mk_ids:
        att  = attendance.get(mk_id, 0.0)
        bills = bill_counts.get(mk_id, 0)

        att_pct   = round(percentile_rank(att_vals,  att)  * 100)
        bills_pct = round(percentile_rank(bill_vals, bills) * 100)

        # Attendance weighted 60%, bills 40%
        score = round(att_pct * 0.6 + bills_pct * 0.4)

        if score >= 80:   grade = "A"
        elif score >= 65: grade = "B"
        elif score >= 50: grade = "C"
        elif score >= 35: grade = "D"
        else:             grade = "F"

        results[mk_id] = {
            "attendance_pct": round(att * 100, 1),
            "bill_count":     bills,
            "activity_score": score,
            "activity_grade": grade,
        }

    return results


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

    print("\nScoring MKs + computing attendance (single pass over shadow CSV)...")
    mk_scores, mk_names_shadow, mk_knessets, mk_latest_faction, mk_attendance = build_mk_vote_scores(
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

    # Build preliminary MK list (before activity grades) to collect PersonIDs
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

        # PersonID in individual CSV is numeric; kmmbr_id in shadow CSV is zero-padded.
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

    print(f"\nIntermediate: {len(mks_out)} MKs before activity grades")
    print(f"  Skipped — unknown/unmapped party: {skipped_unknown_party}")

    # Fetch bill counts from Knesset OData
    print(f"\nFetching bill counts from Knesset OData...")
    person_ids = [str(int(mk["id"])) for mk in mks_out]
    bill_counts_by_person_id = fetch_mk_bill_counts(person_ids)
    # Re-key by zero-padded mk_id
    bill_counts = {mk["id"]: bill_counts_by_person_id.get(str(int(mk["id"])), 0) for mk in mks_out}

    # Compute activity grades
    mk_ids_list = [mk["id"] for mk in mks_out]
    activity = compute_activity_grades(mk_ids_list, mk_attendance, bill_counts)

    # Attach activity fields to each MK record
    for mk in mks_out:
        act = activity.get(mk["id"], {})
        mk["attendance_pct"] = act.get("attendance_pct", 0.0)
        mk["bill_count"]     = act.get("bill_count", 0)
        mk["activity_score"] = act.get("activity_score", 0)
        mk["activity_grade"] = act.get("activity_grade", "F")

    # Summary stats
    print(f"\nFinal output: {len(mks_out)} MKs")

    grades = [mk["activity_grade"] for mk in mks_out]
    from collections import Counter
    grade_dist = Counter(grades)
    print(f"  Grade distribution: {dict(sorted(grade_dist.items()))}")

    att_sample = sorted(mks_out, key=lambda m: -m["attendance_pct"])[:5]
    print(f"\n  Top 5 by attendance:")
    for mk in att_sample:
        print(f"    {mk['name_he']:<20} {mk['attendance_pct']:.1f}%  bills={mk['bill_count']}  grade={mk['activity_grade']}")

    bill_sample = sorted(mks_out, key=lambda m: -m["bill_count"])[:5]
    print(f"\n  Top 5 by bills:")
    for mk in bill_sample:
        print(f"    {mk['name_he']:<20} bills={mk['bill_count']}  att={mk['attendance_pct']:.1f}%  grade={mk['activity_grade']}")

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
