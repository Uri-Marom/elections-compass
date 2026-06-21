#!/usr/bin/env python3
"""
Manages last_updated tracking for stated_position entries.

Two modes:
  Backfill   — adds last_updated to every stated_position that is missing it.
               Use this once to initialize tracking, then maintain it manually
               whenever you review/update a party's stated position.

  Stale check — reports which party-question pairs haven't been updated in
                more than STALE_DAYS (default 180). Use this to prioritise
                review work.

Usage:
    python scripts/update_stated_positions.py              # stale report only
    python scripts/update_stated_positions.py --backfill   # add missing last_updated, then report
    python scripts/update_stated_positions.py --stale-days 90   # tighter threshold

Note: --backfill writes today's date as last_updated for any entry that is
missing it. This means "last reviewed on this date", not "last changed".
After running --backfill, update last_updated manually whenever you change
or verify a stated_position score.
"""

import json
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT           = Path(__file__).parent.parent
POSITIONS_DIR  = ROOT / "src" / "data" / "positions"
DEFAULT_STALE  = 180  # days


def load_positions() -> list[tuple[Path, dict]]:
    files = sorted(POSITIONS_DIR.glob("*.json"))
    result = []
    for f in files:
        with open(f) as fp:
            result.append((f, json.load(fp)))
    return result


def backfill_last_updated(today_str: str) -> int:
    """
    Adds last_updated = today_str to any stated_position missing it.
    Returns the number of entries updated.
    """
    files = load_positions()
    total_added = 0

    for filepath, data in files:
        changed = False
        for pos in data.get("positions", []):
            sp = pos.get("stated_position")
            if sp and "last_updated" not in sp:
                sp["last_updated"] = today_str
                changed = True
                total_added += 1

        if changed:
            with open(filepath, "w") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  {filepath.stem}: backfilled last_updated", flush=True)

    return total_added


def stale_report(stale_days: int) -> list[dict]:
    """
    Returns a list of stale entries: dicts with party_id, question_id,
    last_updated, age_days, source (truncated).
    Entries without last_updated are treated as maximally stale.
    """
    files = load_positions()
    today = date.today()
    cutoff = today - timedelta(days=stale_days)
    stale: list[dict] = []

    for _, data in files:
        party_id = data["party_id"]
        for pos in data.get("positions", []):
            sp = pos.get("stated_position")
            if not sp:
                continue
            lu_str = sp.get("last_updated")
            if lu_str:
                try:
                    lu = date.fromisoformat(lu_str)
                except ValueError:
                    lu = None
            else:
                lu = None

            if lu is None or lu < cutoff:
                age_days = (today - lu).days if lu else None
                stale.append({
                    "party_id":    party_id,
                    "question_id": pos["question_id"],
                    "last_updated": lu_str or "MISSING",
                    "age_days":    age_days,
                    "score":       sp.get("score"),
                    "source":      (sp.get("source") or "")[:70],
                })

    stale.sort(key=lambda x: (x["age_days"] is None, -(x["age_days"] or 9999)))
    return stale


def main() -> None:
    args = sys.argv[1:]
    do_backfill = "--backfill" in args
    stale_days  = DEFAULT_STALE

    for arg in args:
        if arg.startswith("--stale-days="):
            try:
                stale_days = int(arg.split("=", 1)[1])
            except ValueError:
                sys.exit(f"ERROR: invalid --stale-days value: {arg}")

    today_str = date.today().isoformat()

    if do_backfill:
        print(f"Backfilling missing last_updated = {today_str} ...", flush=True)
        n = backfill_last_updated(today_str)
        if n:
            print(f"  Added last_updated to {n} stated_position entries.", flush=True)
        else:
            print("  All stated_position entries already have last_updated.", flush=True)
        print(flush=True)

    print(f"Stale stated positions (not updated in >{stale_days} days):", flush=True)
    stale = stale_report(stale_days)

    if not stale:
        print(f"  None — all positions updated within the last {stale_days} days.")
        return

    # Group by party for readability
    by_party: dict[str, list] = {}
    for entry in stale:
        by_party.setdefault(entry["party_id"], []).append(entry)

    for party_id, entries in sorted(by_party.items()):
        missing = [e for e in entries if e["last_updated"] == "MISSING"]
        oldest  = max((e["age_days"] or 9999) for e in entries)
        label   = f"{len(missing)} missing" if missing else f"oldest={oldest}d"
        print(f"\n  {party_id} ({len(entries)} questions, {label})")
        for e in entries:
            age_str = f"{e['age_days']}d ago" if e["age_days"] else "NO DATE"
            print(f"    {e['question_id']}  score={e['score']:+}  {age_str:>12}  {e['source']}")

    print(f"\nTotal stale entries: {len(stale)}", flush=True)

    if not do_backfill:
        entries_no_date = sum(1 for e in stale if e["last_updated"] == "MISSING")
        if entries_no_date:
            print(f"\n  {entries_no_date} entries have no last_updated at all.")
            print("  Run with --backfill to initialise them with today's date.")


if __name__ == "__main__":
    main()
