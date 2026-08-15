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

# New parties that had no faction of their own in the 25th Knesset, but whose
# leaders sat in it. Their voted_position is derived from those MKs' own votes.
# mk_ids are PersonIDs as they appear in mks.json / mk_positions.json.
# "fallback_party" fills questions the leaders themselves were not recorded on,
# using the faction they sat with in the 25th Knesset.
MK_DERIVED_PARTIES = {
    "achdut": {
        "mk_ids": ["000000532"],  # Yuli Edelstein (Likud, no. 2 on the list)
        "source": "Voted as a Likud MK in the 25th Knesset (Yuli Edelstein, no. 2 on the list)",
        "fallback_party": "likud",
        "fallback_source": "Likud faction aggregate — the party's leaders sat with Likud until August 2026; this question has no recorded vote of their own, so the faction's aggregated record is shown",
    },
    "miluimnikim": {
        "mk_ids": ["000030683"],  # Chili Tropper (National Unity)
        "source": "Voted as a National Unity MK in the 25th Knesset (Chili Tropper)",
        "fallback_party": "national_unity",
        "fallback_source": "National Unity faction aggregate — Tropper's faction; no recorded vote of his own on this question and Hendel was not a 25th-Knesset MK",
    },
    "beyachad": {
        # Bennett had no 25th-Knesset faction; Lapid's Yesh Atid is the half of
        # the joint list with a voting record. Manual encodings take priority.
        "mk_ids": [],
        "source": "Yesh Atid voting record in the 25th Knesset",
        "fallback_party": "yesh_atid",
        "fallback_source": "Yesh Atid faction aggregate — Yesh Atid is one half of the Beyachad joint list; Bennett's party had no 25th-Knesset faction",
    },
    "yashar": {
        "mk_ids": ["000030836", "000030662"],  # Gadi Eisenkot, Matan Kahana
        "source": "Own votes as National Unity MKs in the 25th Knesset (Eisenkot, Kahana)",
        "fallback_party": "national_unity",
        "fallback_source": "National Unity faction aggregate — both leaders sat with National Unity until July 2025; no recorded vote of their own on this question, so the faction's aggregated record is shown",
    },
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


def apply_mk_derived_parties(
    mk_scores: dict[str, dict[str, float]],
    mk_positions: dict[str, dict[str, float]],
) -> dict[str, set[str]]:
    """
    Fills in scores for parties in MK_DERIVED_PARTIES from the individual voting
    records of their leaders. Mutates mk_scores; returns qid -> {party_id} for
    the pairs that were derived this way (used to pick the right source string).
    """
    derived: dict[str, set[str]] = defaultdict(set)

    for party_id, spec in MK_DERIVED_PARTIES.items():
        pools: dict[str, list[float]] = defaultdict(list)
        for mk_id in spec["mk_ids"]:
            for qid, score in mk_positions.get(mk_id, {}).items():
                pools[qid].append(score)
        for qid, vals in pools.items():
            mk_scores.setdefault(qid, {})[party_id] = round(mean(vals), 2)
            derived[qid].add(party_id)

    return derived


def apply_faction_fallback(
    voted_positions: dict[str, dict[str, float]],
) -> dict[str, set[str]]:
    """
    For questions where a derived party's own leaders have no recorded vote,
    fall back to the faction they sat with in the 25th Knesset. Runs after the
    manual fallback so it can also inherit manually encoded faction positions.
    Mutates voted_positions; returns qid -> {party_id} for the pairs it filled.
    """
    fallback: dict[str, set[str]] = defaultdict(set)

    for party_id, spec in MK_DERIVED_PARTIES.items():
        source_party = spec.get("fallback_party")
        if not source_party:
            continue
        for qid, scores in voted_positions.items():
            if party_id in scores or source_party not in scores:
                continue
            scores[party_id] = scores[source_party]
            fallback[qid].add(party_id)

    return fallback


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
    derived_set: dict[str, set[str]],
    fallback_set: dict[str, set[str]],
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
                if party_id in derived_set.get(qid, set()):
                    source = MK_DERIVED_PARTIES[party_id]["source"]
                elif party_id in fallback_set.get(qid, set()):
                    source = MK_DERIVED_PARTIES[party_id]["fallback_source"]
                elif party_id in manual_set.get(qid, set()):
                    source = SOURCE_MANUAL
                else:
                    source = SOURCE_MK
                pos["voted_position"] = {
                    "score": score,
                    "last_updated": today,
                    "source": source,
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

    print("\nDeriving voted positions for new parties from their leaders' own records...")
    derived_set = apply_mk_derived_parties(mk_scores, mk_positions)
    for party_id in MK_DERIVED_PARTIES:
        n = sum(1 for parties in derived_set.values() if party_id in parties)
        print(f"  {party_id}: {n} questions from their own votes")

    print("\nApplying manual fallback for unscored parties/questions...")
    voted_positions, manual_set = apply_manual_fallback(mk_scores, mappings)
    total_manual = sum(len(v) for v in manual_set.values())
    print(f"  {total_manual} party-question scores filled from manual_k25")

    print("\nFilling remaining questions for new parties from their 25th-Knesset faction...")
    fallback_set = apply_faction_fallback(voted_positions)
    for party_id in MK_DERIVED_PARTIES:
        f = sum(1 for parties in fallback_set.values() if party_id in parties)
        print(f"  {party_id}: {f} questions from {MK_DERIVED_PARTIES[party_id].get('fallback_party')}")

    print("\nWriting voted_position to party JSON files...")
    update_party_files(voted_positions, manual_set, derived_set, fallback_set)

    print("\nDone.")


if __name__ == "__main__":
    main()
