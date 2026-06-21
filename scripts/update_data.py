#!/usr/bin/env python3
"""
Unified data update pipeline for the elections tool.

Steps (run in order by default):

  Step 1 — polls
    Fetches the latest seat projections from themadad.com/allpolls/ and
    writes 30-day median poll_seats into src/data/parties.json.

  Step 2 — mk-data
    Downloads fresh MK/faction/vote CSVs from oknesset.org, scores each
    K25 MK on mapped questions, and writes src/data/mks.json +
    src/data/mk_positions.json.

  Step 3 — vote-positions
    Aggregates the per-MK scores (step 2) to party-level means and writes
    voted_position into each src/data/positions/<party>.json file.
    Also derives divergence_flag vs stated_position.

  Step 4 — vote-suggest  (report only, never writes)
    Fetches K25 plenary vote records from the Knesset OData API and
    searches for votes matching per-question Hebrew keywords that are not
    yet in vote_mappings.json. Output helps you decide which new vote IDs
    to add manually.

  Step 5 — stated-positions  (report; writes only with --write)
    Reports stated_position entries not updated in >STALE_DAYS days.
    With --write: backfills last_updated = today on entries missing it.
    Stated positions must still be reviewed and updated manually.

Usage:
    python scripts/update_data.py                 # dry-run, all steps
    python scripts/update_data.py --write         # write all changes to disk

    python scripts/update_data.py --only polls,mk-data   # subset of steps
    python scripts/update_data.py --skip mk-data         # skip heavy step 2
    python scripts/update_data.py --only vote-suggest    # just suggestions
    python scripts/update_data.py --only stated-positions --write  # backfill dates

    python scripts/update_data.py --stale-days=90        # tighter staleness threshold

Notes:
    • Step 3 depends on step 2 output. Running --only vote-positions without
      first running step 2 uses the existing mks.json / mk_positions.json.
    • Step 2 downloads ~200 MB of plenary vote data; expect 5–15 minutes.
    • Steps 4 and 5 are skipped by default (pass --include-optional to run them
      or name them explicitly in --only).
    • vote-suggest and stated-positions never abort on failure — they're
      advisory and won't block the data pipeline.
"""

import subprocess
import sys
import time
from pathlib import Path

ROOT    = Path(__file__).parent.parent
SCRIPTS = Path(__file__).parent

# Core steps run by default; optional steps must be named explicitly.
CORE_STEPS     = ["polls", "mk-data", "vote-positions"]
OPTIONAL_STEPS = ["vote-suggest", "stated-positions"]
STEPS          = CORE_STEPS + OPTIONAL_STEPS

STEP_LABELS = {
    "polls":            "Step 1 — Poll seat projections (themadad.com)",
    "mk-data":          "Step 2 — MK vote data (oknesset.org)",
    "vote-positions":   "Step 3 — Party voted positions (derived from MK data)",
    "vote-suggest":     "Step 4 — Vote mapping candidates (Knesset OData, report only)",
    "stated-positions": "Step 5 — Stated position staleness (report + optional backfill)",
}

STEP_SCRIPTS = {
    "polls":            SCRIPTS / "update_polls.py",
    "mk-data":          SCRIPTS / "build_mk_data.py",
    "vote-positions":   SCRIPTS / "update_voting_data.py",
    "vote-suggest":     SCRIPTS / "suggest_vote_mappings.py",
    "stated-positions": SCRIPTS / "update_stated_positions.py",
}

# Steps that support --write (dry-run by default); others always write.
SUPPORTS_WRITE_FLAG = {"polls", "mk-data", "stated-positions"}

# Steps that support additional flags passed through from update_data.py args.
PASSTHROUGH_FLAGS: dict[str, list[str]] = {
    "stated-positions": [],  # populated at parse time with --stale-days if given
}

# Steps that don't abort the pipeline on failure (advisory).
NON_FATAL_STEPS = {"vote-suggest", "stated-positions"}


def parse_args() -> tuple[bool, set[str], dict[str, list[str]]]:
    """Returns (write_mode, steps_to_run, extra_flags_per_step)."""
    args = sys.argv[1:]
    write_mode    = "--write" in args
    include_opt   = "--include-optional" in args
    args = [a for a in args if a not in ("--write", "--include-optional")]

    only_steps: set[str] = set()
    skip_steps: set[str] = set()
    extra: dict[str, list[str]] = {s: [] for s in STEPS}
    stale_days: str | None = None

    for arg in args:
        if arg.startswith("--only="):
            only_steps = {s.strip() for s in arg[len("--only="):].split(",")}
        elif arg.startswith("--skip="):
            skip_steps = {s.strip() for s in arg[len("--skip="):].split(",")}
        elif arg.startswith("--stale-days="):
            stale_days = arg  # e.g. "--stale-days=90"
        else:
            print(f"WARNING: unknown argument '{arg}' — ignoring.", flush=True)

    if stale_days:
        extra["stated-positions"].append(stale_days)

    invalid = (only_steps | skip_steps) - set(STEPS)
    if invalid:
        sys.exit(f"ERROR: unknown step(s): {', '.join(sorted(invalid))}. "
                 f"Valid: {', '.join(STEPS)}")

    if only_steps and skip_steps:
        sys.exit("ERROR: --only and --skip are mutually exclusive.")

    if only_steps:
        active = [s for s in STEPS if s in only_steps]
    elif skip_steps:
        active_base = [s for s in CORE_STEPS if s not in skip_steps]
        active_opt  = [s for s in OPTIONAL_STEPS if s in skip_steps] if include_opt else []
        active = active_base + active_opt
    else:
        active = list(CORE_STEPS) + (list(OPTIONAL_STEPS) if include_opt else [])

    return write_mode, set(active), extra


def run_step(step: str, write_mode: bool, extra_flags: list[str]) -> bool:
    """
    Runs a single update step as a subprocess.
    Returns True on success, False on failure.
    """
    script = STEP_SCRIPTS[step]
    cmd = [sys.executable, str(script)]
    if write_mode and step in SUPPORTS_WRITE_FLAG:
        cmd.append("--write")
    if write_mode and step == "stated-positions":
        cmd.append("--backfill")
    cmd.extend(extra_flags)

    t0 = time.time()
    result = subprocess.run(cmd, cwd=ROOT)
    elapsed = time.time() - t0

    ok = result.returncode == 0
    status = "OK" if ok else f"FAILED (exit {result.returncode})"
    print(f"\n[{step}] {status} in {elapsed:.1f}s", flush=True)
    return ok


def main() -> None:
    write_mode, active_steps, extra_flags = parse_args()

    print("=" * 60, flush=True)
    print("Elections tool — unified data update", flush=True)
    print("=" * 60, flush=True)
    if write_mode:
        print("Mode: WRITE — changes will be saved to disk", flush=True)
    else:
        print("Mode: DRY-RUN — pass --write to save changes", flush=True)

    skipped = [s for s in STEPS if s not in active_steps]
    if skipped:
        print(f"Skipping: {', '.join(skipped)}", flush=True)

    print(flush=True)

    results: dict[str, bool | None] = {s: None for s in STEPS}
    overall_start = time.time()

    for step in STEPS:
        if step not in active_steps:
            continue

        print("-" * 60, flush=True)
        print(STEP_LABELS[step], flush=True)
        if step not in SUPPORTS_WRITE_FLAG and step not in NON_FATAL_STEPS:
            print("  (note: this step has no dry-run mode — always writes)", flush=True)
        if step in NON_FATAL_STEPS:
            print("  (advisory — failures here do not abort the pipeline)", flush=True)
        print("-" * 60, flush=True)

        ok = run_step(step, write_mode, extra_flags.get(step, []))
        results[step] = ok

        if not ok and step not in NON_FATAL_STEPS:
            print(f"\nAborting: step '{step}' failed. Fix errors above and re-run.", flush=True)
            break

        print(flush=True)

    total = time.time() - overall_start
    print("=" * 60, flush=True)
    print(f"Done in {total:.1f}s", flush=True)
    for step in STEPS:
        if step not in active_steps:
            print(f"  {step:<20} skipped", flush=True)
        elif results[step] is None:
            print(f"  {step:<20} not reached (pipeline aborted)", flush=True)
        else:
            icon = "✓" if results[step] else "✗"
            print(f"  {step:<20} {icon}", flush=True)
    print(flush=True)

    if not write_mode and active_steps:
        print("Dry-run complete. Run with --write to persist changes.", flush=True)

    fatal_failures = [
        s for s in active_steps
        if results.get(s) is False and s not in NON_FATAL_STEPS
    ]
    if fatal_failures:
        sys.exit(1)

    print("\nManual-only updates (cannot be automated):", flush=True)
    print("  • stated_position scores — review with: python scripts/update_stated_positions.py", flush=True)
    print("  • vote_mappings.json     — review candidates: python scripts/suggest_vote_mappings.py", flush=True)
    print("  • seats                  — actual K25 seat counts (only changes after an election)", flush=True)
    print("  • bloc                   — coalition/opposition assignments (changes with govt)", flush=True)


if __name__ == "__main__":
    main()
