#!/usr/bin/env python3
"""
Reviews party stated positions against official party platforms using Claude.

For each party in PARTY_PLATFORMS, fetches the platform pages, then calls
Claude to compare the fetched content against current stated positions in
src/data/positions/<party>.json. Suggests score and source corrections.

Dry-run by default — prints a diff report. Use --write to apply changes.

Usage:
    python scripts/review_platforms.py                    # dry-run all parties
    python scripts/review_platforms.py likud democrats    # specific parties only
    python scripts/review_platforms.py --write            # apply all suggestions
    python scripts/review_platforms.py --force            # re-review recently updated positions too
    python scripts/review_platforms.py yashar --force     # force-review a single party

Requires: ANTHROPIC_API_KEY environment variable
"""

import json
import os
import re
import sys
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Optional
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from html.parser import HTMLParser

ROOT          = Path(__file__).parent.parent
POSITIONS_DIR = ROOT / "src" / "data" / "positions"
QUESTIONS_FILE = ROOT / "src" / "data" / "questions.json"

TODAY = date.today().isoformat()

# How recently a position must have been updated to be skipped (unless --force)
SKIP_IF_UPDATED_WITHIN_DAYS = 7

# Phrases in source fields that indicate a vague/placeholder source
# — these positions are always reviewed even within the skip window
VAGUE_SOURCE_PATTERNS = [
    "neutral", "not a priority", "coalition alignment", "coalition policy",
    "coalition loyalty", "coalition agreement", "no stated position",
    "no public stance", "no detailed platform", "varied positions",
    "historically opposed but pragmatic", "pragmatic center",
    "open to future", "mixed record",
]

# Official platform URLs per party.
# List multiple URLs per party to fetch and concatenate (agenda pages, mission pages, etc.)
# None = no platform URL known; script prints a warning and skips.
PARTY_PLATFORMS: Dict[str, Optional[List[str]]] = {
    "yashar": [
        "https://yasharwitheisenkot.com/",
        "https://yasharwitheisenkot.com/agenda_point/",
        "https://yasharwitheisenkot.com/topic/missions/",
    ],
    "democrats": [
        "https://democrats.org.il/",
    ],
    "yesh_atid": [
        "https://www.yeshatid.org.il/",
    ],
    "beyachad": [
        "https://bennett2026.org.il/",
        "https://bennett2026.org.il/en/home-en/",
        "https://bennett2026.org.il/en/plans/",
    ],
    "bennett_2026": [
        "https://bennett2026.org.il/en/home-en/",
        "https://bennett2026.org.il/en/plans/",
    ],
    "miluimnikim": [
        "https://www.miluimnikim.org.il/",
    ],
    "likud": [
        "https://www.likud.org.il/",
    ],
    "national_unity": [
        "https://www.machne.co.il/",
    ],
    "yisrael_beitenu": [
        "https://www.yb.org.il/",
    ],
    "shas": [
        "https://www.shasnet.org.il/",
    ],
    "hadash_taal": [
        "https://www.hadash.org.il/",
    ],
    "raam": None,     # No accessible platform website found
    "utj": None,      # No accessible platform website found
    "otzma": [
        "https://www.otzma.org.il/",
    ],
    "religious_zionism": [
        "https://zionutdatit.org.il/en/about/",
        "https://zionutdatit.org.il/",
    ],
    "otzma_rzp": [
        "https://zionutdatit.org.il/en/about/",
    ],
}


# ── HTML text extraction ──────────────────────────────────────────────────────

class _TextExtractor(HTMLParser):
    """Strips HTML tags and returns visible text."""

    SKIP_TAGS = {"script", "style", "noscript", "nav", "footer", "header", "aside"}

    def __init__(self):
        super().__init__()
        self._skip = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP_TAGS:
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP_TAGS and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if not self._skip:
            text = data.strip()
            if text:
                self.parts.append(text)


def _html_to_text(html: str) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(html)
    except Exception:
        pass
    return "\n".join(parser.parts)


def fetch_platform_text(urls: List[str], verbose: bool = True) -> str:
    """Fetch and concatenate text content from a list of URLs."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; elections-tool-bot/1.0)",
        "Accept-Language": "he,en;q=0.9",
    }
    chunks: list[str] = []
    for url in urls:
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=15) as resp:
                raw = resp.read()
                encoding = resp.headers.get_content_charset("utf-8") or "utf-8"
                html = raw.decode(encoding, errors="replace")
                text = _html_to_text(html)
                # Collapse whitespace but keep paragraph breaks
                text = re.sub(r"[ \t]+", " ", text)
                text = re.sub(r"\n{3,}", "\n\n", text)
                if text.strip():
                    chunks.append(f"[Source: {url}]\n{text.strip()}")
                    if verbose:
                        print(f"    fetched {url} ({len(text):,} chars)", flush=True)
                else:
                    if verbose:
                        print(f"    ⚠ {url} returned empty text", flush=True)
        except HTTPError as e:
            if verbose:
                print(f"    ✗ {url} → HTTP {e.code}", flush=True)
        except URLError as e:
            if verbose:
                print(f"    ✗ {url} → {e.reason}", flush=True)
        except Exception as e:
            if verbose:
                print(f"    ✗ {url} → {e}", flush=True)
        time.sleep(0.5)  # polite crawl delay

    return "\n\n---\n\n".join(chunks)


# ── Data loading ──────────────────────────────────────────────────────────────

def load_questions() -> list[dict]:
    with open(QUESTIONS_FILE) as f:
        return json.load(f)


def load_positions(party_id: str) -> Optional[dict]:
    path = POSITIONS_DIR / f"{party_id}.json"
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


# ── Skip logic ────────────────────────────────────────────────────────────────

def _is_vague_source(source: str) -> bool:
    s = (source or "").lower()
    return any(p in s for p in VAGUE_SOURCE_PATTERNS)


def should_skip(stated_position: dict, force: bool) -> bool:
    """Return True if this position should be skipped (recently reviewed with good source)."""
    if force:
        return False
    lu_str = stated_position.get("last_updated")
    if not lu_str:
        return False  # never updated — always review
    try:
        lu = date.fromisoformat(lu_str)
    except ValueError:
        return False
    cutoff = date.today() - timedelta(days=SKIP_IF_UPDATED_WITHIN_DAYS)
    if lu < cutoff:
        return False  # stale — review
    # Recently updated: only skip if source is not vague
    return not _is_vague_source(stated_position.get("source", ""))


# ── Claude review ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert analyst of Israeli politics. You compare party official platform
text against existing position scores and identify inaccuracies.

Scoring system:
  +2 = strongly agrees with the statement
  +1 = somewhat agrees
   0 = neutral / not addressed / ambiguous
  -1 = somewhat disagrees
  -2 = strongly disagrees

You only suggest score changes when the platform text provides CLEAR evidence
that the current score is wrong. You do not change scores speculatively.

Respond ONLY with a valid JSON array. Each item must have:
  {
    "question_id": "qNN",
    "current_score": <number>,
    "suggested_score": <number or null>,   // null = no change
    "confidence": "high" | "medium" | "low",
    "reasoning": "<1-2 sentence explanation>",
    "new_source": "<short source string citing the platform, max 120 chars>"
  }

Only include entries where suggested_score != current_score AND confidence is "high" or "medium".
If no changes are warranted, return an empty array [].
"""


def build_review_prompt(
    party_name: str,
    questions: list[dict],
    positions_to_review: list[dict],
    platform_text: str,
) -> str:
    # Build a compact question reference
    q_map = {q["id"]: q for q in questions}

    lines = [
        f"Party: {party_name}",
        "",
        "## Questions (score range: -2 to +2)",
        "",
    ]
    for pos in positions_to_review:
        qid = pos["question_id"]
        q = q_map.get(qid, {})
        sp = pos.get("stated_position", {})
        lines.append(
            f"{qid} | score={sp.get('score'):+} | "
            f"EN: {q.get('text_en','')[:100]} | "
            f"source: {(sp.get('source',''))[:80]}"
        )

    lines += [
        "",
        "## Official Platform Text",
        "",
        platform_text[:12000],  # cap to avoid token limits
        "",
        "## Task",
        "Review each question above. For any where the platform text clearly contradicts "
        "or does not support the current score, suggest a corrected score. "
        "Return JSON as specified.",
    ]

    return "\n".join(lines)


def call_claude(prompt: str) -> list[dict]:
    """Call Claude and return parsed list of suggested changes."""
    import anthropic  # imported here so the script fails gracefully if not installed

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("ERROR: ANTHROPIC_API_KEY environment variable not set.")

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()

    # Extract JSON array from response (Claude sometimes adds markdown fences)
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        print(f"    ⚠ Claude returned no JSON array; raw response:\n{raw[:300]}", flush=True)
        return []

    try:
        suggestions = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        print(f"    ⚠ Failed to parse Claude JSON: {e}\n{raw[:300]}", flush=True)
        return []

    # Filter: only include where suggested != current and confidence is actionable
    actionable = [
        s for s in suggestions
        if s.get("suggested_score") is not None
        and s.get("suggested_score") != s.get("current_score")
        and s.get("confidence") in ("high", "medium")
    ]
    return actionable


# ── Apply / report changes ────────────────────────────────────────────────────

def apply_changes(party_id: str, suggestions: list[dict], write: bool) -> None:
    path = POSITIONS_DIR / f"{party_id}.json"
    with open(path) as f:
        data = json.load(f)

    # Index positions by question_id
    pos_map = {p["question_id"]: p for p in data["positions"]}

    applied = 0
    for s in suggestions:
        qid = s["question_id"]
        new_score = s["suggested_score"]
        new_source = s.get("new_source", "")
        confidence = s.get("confidence", "?")
        reasoning = s.get("reasoning", "")
        old_score = s.get("current_score")

        direction = "→"
        print(
            f"  {qid}  {old_score:+} {direction} {new_score:+}  [{confidence.upper()}]",
            flush=True,
        )
        print(f"    reason: {reasoning}", flush=True)
        print(f"    source: {new_source}", flush=True)

        if write and qid in pos_map:
            pos = pos_map[qid]
            sp = pos.setdefault("stated_position", {})
            sp["score"] = new_score
            sp["source"] = new_source
            sp["last_updated"] = TODAY

            # Recompute divergence_flag
            vp_score = pos.get("voted_position", {}).get("score")
            if vp_score is not None:
                pos["divergence_flag"] = abs(new_score - vp_score) > 1
            applied += 1

    if write and applied:
        with open(path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  ✓ wrote {applied} change(s) to {path.name}", flush=True)
    elif write and not applied:
        print("  (no changes written)", flush=True)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    args = sys.argv[1:]
    write = "--write" in args
    force = "--force" in args

    # Collect explicit party IDs from args (non-flag args)
    requested = [a for a in args if not a.startswith("--")]

    questions = load_questions()

    # Determine which parties to process
    if requested:
        parties = requested
    else:
        parties = sorted(p.stem for p in POSITIONS_DIR.glob("*.json"))

    if write:
        print(f"Mode: WRITE — changes will be applied to JSON files", flush=True)
    else:
        print(f"Mode: DRY RUN — no files will be modified (use --write to apply)", flush=True)
    print(flush=True)

    total_suggestions = 0

    for party_id in parties:
        data = load_positions(party_id)
        if data is None:
            print(f"=== {party_id} — file not found, skipping ===", flush=True)
            continue

        party_name = f"{data.get('party_id', party_id)}"
        platform_urls = PARTY_PLATFORMS.get(party_id)

        print(f"=== {party_id} ===", flush=True)

        if platform_urls is None:
            print("  ⚠ No platform URL configured — skipping", flush=True)
            print(flush=True)
            continue

        # Fetch platform text
        print("  Fetching platform pages...", flush=True)
        platform_text = fetch_platform_text(platform_urls)
        if not platform_text.strip():
            print("  ✗ All platform URLs failed or returned empty — skipping", flush=True)
            print(flush=True)
            continue

        # Determine which positions to review (skip recently updated ones)
        positions_to_review = []
        skipped = 0
        for pos in data.get("positions", []):
            sp = pos.get("stated_position")
            if not sp:
                continue
            if should_skip(sp, force):
                skipped += 1
            else:
                positions_to_review.append(pos)

        if skipped:
            print(f"  Skipping {skipped} recently-updated positions (use --force to re-review)", flush=True)

        if not positions_to_review:
            print("  All positions recently reviewed — nothing to check", flush=True)
            print(flush=True)
            continue

        print(f"  Reviewing {len(positions_to_review)} positions with Claude...", flush=True)
        prompt = build_review_prompt(party_name, questions, positions_to_review, platform_text)

        suggestions = call_claude(prompt)

        if not suggestions:
            print("  ✓ No discrepancies found", flush=True)
        else:
            print(f"  {len(suggestions)} suggested change(s):", flush=True)
            apply_changes(party_id, suggestions, write)
            total_suggestions += len(suggestions)

        print(flush=True)

    print(f"Done. Total suggestions: {total_suggestions}", flush=True)
    if total_suggestions and not write:
        print("Run with --write to apply changes.", flush=True)


if __name__ == "__main__":
    main()
