#!/usr/bin/env python3
"""
Fetches Knesset voting records from the official Knesset OData service and
the hasadna pipelines CSV, then computes per-party voted_position scores for
each survey question.

Sources:
  - production.oknesset.org/pipelines/data/votes/vote_rslts_kmmbr_shadow/
    Contains individual MK votes up through the 24th Knesset.
  - src/data/vote_mappings.json
    Maps survey questions to vote IDs + manual_k25 overrides for 25th Knesset
    landmark votes that are not yet in the pipeline data.

Writes voted_position into each party JSON file under src/data/positions/.
"""

import csv, json, urllib.request, io, sys, os
from pathlib import Path

ROOT = Path(__file__).parent.parent
POSITIONS_DIR = ROOT / "src" / "data" / "positions"
MAPPINGS_FILE = ROOT / "src" / "data" / "vote_mappings.json"
SHADOW_CSV_URL = "https://production.oknesset.org/pipelines/data/votes/vote_rslts_kmmbr_shadow/vote_rslts_kmmbr_shadow.csv"

# Maps faction_id (str) -> our party_id
# Covers 22nd, 23rd, and 24th Knessets so we can use votes across all three
FACTION_MAP = {
    # 22nd Knesset (2019)
    "942": "likud",
    "945": "yisrael_beitenu",
    "946": "national_unity",  # כחול לבן
    "947": "shas",
    "944": "utj",
    "948": "otzma_rzp",       # ימינה
    "949": "democrats",       # עבודה-גשר-מרצ
    "943": "hadash_taal",     # רשימה משותפת

    # 23rd Knesset (2020-2021)
    "962": "likud",
    "971": "shas",
    "965": "utj",
    "961": "otzma_rzp",       # ציונות דתית
    "967": "yesh_atid",       # יש עתיד
    "969": "national_unity",  # כחול לבן
    "963": "democrats",       # עבודה
    "970": "democrats",       # מרצ (same bloc → democrats)
    "968": "yisrael_beitenu",
    "964": "hadash_taal",
    "973": "raam",
    "966": "otzma_rzp",       # ימינה
    "972": "national_unity",  # תקווה חדשה → national_unity bloc

    # 24th Knesset (2021)
    "942": "likud",
    "947": "shas",
    "944": "utj",
    "945": "yisrael_beitenu",
    "959": "democrats",       # מרצ
    "958": "democrats",       # עבודה
    "955": "yesh_atid",       # יש עתיד-תל"ם
}

# vote_result codes
FOR     = "1"
AGAINST = "2"
ABSTAIN = "3"


def load_shadow_votes():
    print("Downloading MK shadow votes CSV...", flush=True)
    with urllib.request.urlopen(SHADOW_CSV_URL, timeout=120) as r:
        content = r.read().decode("utf-8")
    rows = list(csv.DictReader(io.StringIO(content)))
    print(f"  Loaded {len(rows):,} records.", flush=True)
    return rows


def compute_party_scores_from_votes(shadow_rows, vote_ids_directions):
    """
    vote_ids_directions: list of (vote_id: int, direction: str)
      direction: 'for_means_agree' | 'against_means_agree'
    Returns: dict party_id -> float score in [-2, +2] (or None if no data)
    """
    vote_id_strs = {str(vid) for vid, _ in vote_ids_directions}
    direction_map = {str(vid): d for vid, d in vote_ids_directions}

    relevant = [r for r in shadow_rows if r.get("vote_id") in vote_id_strs]
    if not relevant:
        return {}

    # Accumulate per-party vote counts, tracking direction per vote
    # party_data[party][vote_id] = {"for": n, "against": n, "abstain": n, "total": n}
    party_vote_data = {}
    for r in relevant:
        fid = r.get("faction_id", "")
        party = FACTION_MAP.get(fid)
        if not party:
            continue
        vote_res = r.get("vote_result", "")
        vid = r.get("vote_id", "")

        if party not in party_vote_data:
            party_vote_data[party] = {}
        if vid not in party_vote_data[party]:
            party_vote_data[party][vid] = {"for": 0, "against": 0, "abstain": 0, "total": 0}

        party_vote_data[party][vid]["total"] += 1
        if vote_res == FOR:
            party_vote_data[party][vid]["for"] += 1
        elif vote_res == AGAINST:
            party_vote_data[party][vid]["against"] += 1
        elif vote_res == ABSTAIN:
            party_vote_data[party][vid]["abstain"] += 1

    scores = {}
    for party, vote_map in party_vote_data.items():
        total_weight = 0
        weighted_raw = 0.0
        for vid, data in vote_map.items():
            total = data["total"]
            if total == 0:
                continue
            for_pct = data["for"] / total
            against_pct = data["against"] / total
            raw = for_pct * 2 - against_pct * 2  # range [-2, +2]
            direction = direction_map.get(vid, "for_means_agree")
            if direction == "against_means_agree":
                raw = -raw
            weighted_raw += raw
            total_weight += 1
        if total_weight == 0:
            scores[party] = None
        else:
            scores[party] = round(weighted_raw / total_weight, 2)

    return scores


def merge_scores(from_votes, manual_k25):
    """
    Combine CSV-derived scores with manual 25th Knesset overrides.
    Manual scores take precedence when present.
    """
    merged = dict(from_votes)
    if manual_k25 and "party_scores" in manual_k25:
        for party, data in manual_k25["party_scores"].items():
            score = data.get("score") if isinstance(data, dict) else data
            if score is not None:
                merged[party] = score
    return merged


def build_voted_positions(shadow_rows, mappings):
    """
    Returns: dict question_id -> dict party_id -> score
    """
    results = {}
    for qid, mapping in mappings.items():
        if qid.startswith("_"):
            continue

        vote_ids_directions = [
            (v["vote_id"], v["direction"])
            for v in mapping.get("votes", [])
        ]

        csv_scores = {}
        if vote_ids_directions:
            csv_scores = compute_party_scores_from_votes(shadow_rows, vote_ids_directions)

        manual = mapping.get("manual_k25")
        final_scores = merge_scores(csv_scores, manual)

        results[qid] = final_scores
        n = len([s for s in final_scores.values() if s is not None])
        print(f"  {qid}: {n} parties scored", flush=True)

    return results


def update_party_files(voted_positions):
    """Update voted_position in each party JSON file."""
    party_ids = set()
    for scores in voted_positions.values():
        party_ids.update(scores.keys())

    for party_id in sorted(party_ids):
        filepath = POSITIONS_DIR / f"{party_id}.json"
        if not filepath.exists():
            print(f"  WARNING: No file for {party_id}", flush=True)
            continue

        with open(filepath) as f:
            data = json.load(f)

        updated = 0
        for pos in data.get("positions", []):
            qid = pos["question_id"]
            scores = voted_positions.get(qid, {})
            score = scores.get(party_id)

            if score is not None:
                pos["voted_position"] = {
                    "score": score,
                    "last_updated": "2026-04-24",
                    "source": "Knesset vote data via oknesset.org + manual encoding for 25th Knesset"
                }
                if abs(score - pos.get("stated_position", {}).get("score", 0)) > 1:
                    pos["divergence_flag"] = True
                else:
                    pos["divergence_flag"] = False
                updated += 1
            elif "voted_position" in pos:
                del pos["voted_position"]

        with open(filepath, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"  Updated {party_id}: {updated}/{len(data.get('positions', []))} questions", flush=True)


def main():
    print("=== Knesset voting data update ===")

    with open(MAPPINGS_FILE) as f:
        mappings = json.load(f)

    print("Loading shadow votes from oknesset pipelines...")
    shadow_rows = load_shadow_votes()

    print("\nComputing per-question party scores...")
    voted_positions = build_voted_positions(shadow_rows, mappings)

    print("\nWriting voted_position to party JSON files...")
    update_party_files(voted_positions)

    print("\nDone.")


if __name__ == "__main__":
    main()
