#!/usr/bin/env python3
"""
Computes per-party voted_position scores by aggregating MK-level vote data.

Run build_mk_data.py first to generate mks.json and mk_positions.json.

Sources:
  - src/data/mks.json            MK profiles with party assignments (K25 members)
  - src/data/mk_positions.json   Per-MK per-question scores (K25 preferred, fallback to prior)
  - src/data/vote_mappings.json  Provides manual_k25 fallback scores for parties/questions
                                 not covered by MK data (new parties, questions with no vote IDs)

Writes voted_position into each party JSON file under src/data/positions/.

otzma_rzp (historical combined bloc) is derived from the union of otzma + religious_zionism MKs.
"""

import json, datetime
from collections import defaultdict
from pathlib import Path
from statistics import mean

ROOT            = Path(__file__).parent.parent
POSITIONS_DIR   = ROOT / "src" / "data" / "positions"
MAPPINGS_FILE   = ROOT / "src" / "data" / "vote_mappings.json"
MKS_FILE        = ROOT / "src" / "data" / "mks.json"
MK_POSITIONS_FILE = ROOT / "src" / "data" / "mk_positions.json"

# Combined party → set of component party IDs whose MKs are pooled together.
# otzma_rzp ran as separate parties in K25 but is treated as a bloc in the party data.
COMBINED_PARTIES = {
    "otzma_rzp": {"otzma", "religious_zionism"},
}

SOURCE_MK     = "Knesset vote data aggregated from MK-level votes via oknesset.org"
SOURCE_MANUAL = "Manual encoding of 25th Knesset voting positions"


def load_mk_data() -> tuple[dict[str, str], dict[str, dict[str, float]]]:
    with open(MKS_FILE) as f:
        mks = json.load(f)
    with open(MK_POSITIONS_FILE) as f:
        positions = json.load(f)
    mk_party = {mk["id"]: mk["party_id"] for mk in mks}
    return mk_party, positions


def compute_party_scores_from_mks(
    mk_party: dict[str, str],
    mk_positions: dict[str, dict[str, float]],
) -> dict[str, dict[str, float]]:
    """Aggregate MK-level scores to party-level means."""
    raw: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

    for mk_id, scores in mk_positions.items():
        party = mk_party.get(mk_id)
        if not party:
            continue
        for qid, score in scores.items():
            raw[qid][party].append(score)

    # Build combined-party pools from component parties' MKs
    for combined, sources in COMBINED_PARTIES.items():
        for qid, party_lists in raw.items():
            pool: list[float] = []
            for src in sources:
                pool.extend(party_lists.get(src, []))
            if pool:
                raw[qid][combined] = pool

    return {
        qid: {party: round(mean(vals), 2) for party, vals in party_lists.items()}
        for qid, party_lists in raw.items()
    }


def apply_manual_fallback(
    mk_scores: dict[str, dict[str, float]],
    mappings: dict,
) -> tuple[dict[str, dict[str, float]], dict[str, set[str]]]:
    """
    For each question:
      - MK-aggregated scores are primary.
      - manual_k25 fills in only parties not already covered by MK data.
      - Questions with no MK data get all scores from manual_k25.

    Returns (voted_positions, manual_parties) where manual_parties tracks
    which (qid, party_id) pairs came from manual encoding.
    """
    voted: dict[str, dict[str, float]] = {}
    manual_set: dict[str, set[str]] = defaultdict(set)

    for qid, mapping in mappings.items():
        if qid.startswith("_"):
            continue

        base = dict(mk_scores.get(qid, {}))
        manual = mapping.get("manual_k25") or {}

        if manual.get("party_scores"):
            for party, data in manual["party_scores"].items():
                score = data.get("score") if isinstance(data, dict) else data
                if score is not None and party not in base:
                    base[party] = score
                    manual_set[qid].add(party)

        if base:
            voted[qid] = base

    return voted, manual_set


def update_party_files(
    voted_positions: dict[str, dict[str, float]],
    manual_set: dict[str, set[str]],
) -> None:
    today = datetime.date.today().isoformat()

    party_ids: set[str] = set()
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
                is_manual = party_id in manual_set.get(qid, set())
                pos["voted_position"] = {
                    "score": score,
                    "last_updated": today,
                    "source": SOURCE_MANUAL if is_manual else SOURCE_MK,
                }
                stated = pos.get("stated_position", {}).get("score", 0)
                pos["divergence_flag"] = abs(score - stated) > 1
                updated += 1
            elif "voted_position" in pos:
                del pos["voted_position"]

        with open(filepath, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"  {party_id}: {updated}/{len(data.get('positions', []))} questions", flush=True)


def main():
    print("=== Party voted positions update (aggregated from MK-level data) ===\n")

    with open(MAPPINGS_FILE) as f:
        mappings = json.load(f)

    print("Loading MK data...")
    mk_party, mk_positions = load_mk_data()
    print(f"  {len(mk_positions):,} MKs scored, {len(mk_party):,} party assignments")

    print("\nAggregating MK scores to party level...")
    mk_scores = compute_party_scores_from_mks(mk_party, mk_positions)
    for qid, scores in sorted(mk_scores.items()):
        print(f"  {qid}: {len(scores)} parties — {sorted(scores.keys())}")

    print("\nApplying manual fallback for unscored parties/questions...")
    voted_positions, manual_set = apply_manual_fallback(mk_scores, mappings)
    total_manual = sum(len(v) for v in manual_set.values())
    print(f"  {total_manual} party-question scores filled from manual_k25")

    print("\nWriting voted_position to party JSON files...")
    update_party_files(voted_positions, manual_set)

    print("\nDone.")


if __name__ == "__main__":
    main()
