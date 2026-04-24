#!/usr/bin/env python3
"""Adds q31, q32, q33 to all party position files."""
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
POSITIONS_DIR = ROOT / "src" / "data" / "positions"
TODAY = "2026-04-24"
SOURCE_VOTED = f"Manual encoding: 25th Knesset votes — last updated {TODAY}"
SOURCE_PROXY = f"Voted as National Unity MKs in 25th Knesset (Eisenkot & Kahana) — last updated {TODAY}"

# stated, voted (None = no voting data)
# q31: ועדת חקירה ממלכתית לאירועי 7 באוקטובר
# q32: חינוך ליבה חובה לכל בתי הספר המממומנים ציבורית
# q33: רגולציה על תקשורת ומניעת דיסאינפורמציה שיטתית
POSITIONS = {
    "likud": {
        "q31": (-2, -2.0, False),
        "q32": (-1, -2.0, False),
        "q33": (-2, -2.0, False),
    },
    "shas": {
        "q31": (-2, -2.0, False),
        "q32": (-2, -2.0, False),
        "q33": (-1, -1.0, False),
    },
    "utj": {
        "q31": (-2, -2.0, False),
        "q32": (-2, -2.0, False),
        "q33": (0, -0.5, False),
    },
    "otzma": {
        "q31": (-1, -2.0, False),
        "q32": (-1, -1.0, False),
        "q33": (-2, -2.0, False),
    },
    "religious_zionism": {
        "q31": (-2, -2.0, False),
        "q32": (-1, -1.0, False),
        "q33": (-2, -2.0, False),
    },
    "yesh_atid": {
        "q31": (2, 2.0, False),
        "q32": (2, 2.0, False),
        "q33": (1, 1.5, False),
    },
    "national_unity": {
        "q31": (2, 2.0, False),
        "q32": (1, 1.5, False),
        "q33": (1, 1.0, False),
    },
    "yashar": {
        "q31": (2, 2.0, False),   # voted same as national_unity
        "q32": (2, 1.5, False),
        "q33": (1, 1.0, False),
    },
    "bennett_2026": {
        "q31": (2, None, False),
        "q32": (2, None, False),
        "q33": (1, None, False),
    },
    "democrats": {
        "q31": (2, 2.0, False),
        "q32": (2, 2.0, False),
        "q33": (2, 2.0, False),
    },
    "yisrael_beitenu": {
        "q31": (2, 2.0, False),
        "q32": (2, 2.0, False),
        "q33": (1, 1.0, False),
    },
    "miluimnikim": {
        "q31": (2, None, False),
        "q32": (2, None, False),
        "q33": (1, None, False),
    },
    "hadash_taal": {
        "q31": (2, 2.0, False),
        "q32": (1, 1.0, False),
        "q33": (2, 2.0, False),
    },
    "raam": {
        "q31": (1, 1.0, False),
        "q32": (0, 0.0, False),
        "q33": (1, 1.0, False),
    },
}

SOURCES_STATED = {
    "q31": {
        "likud":             "Netanyahu strongly resists — would expose his government's failures before Oct 7",
        "shas":              "Coalition loyalty to Netanyahu; opposes inquiry",
        "utj":               "Coalition loyalty; opposes inquiry",
        "otzma":             "Ambivalent — Ben-Gvir may want inquiry that exposes military/Shin Bet; but coalition loyalty prevails",
        "religious_zionism": "Coalition loyalty; opposes inquiry",
        "yesh_atid":         "Lapid has made state inquiry a central opposition demand since October 2023",
        "national_unity":    "Gantz left the war cabinet partly demanding an inquiry; strongly supports",
        "yashar":            "Eisenkot and Kahana strongly support accountability inquiry; Eisenkot was in the war cabinet",
        "bennett_2026":      "Bennett calls for full accountability; supports state inquiry as former PM who set up intelligence frameworks",
        "democrats":         "Strongly supports — Labor/Meretz have demanded inquiry from day one",
        "yisrael_beitenu":   "Lieberman strongly supports state inquiry; has demanded it repeatedly",
        "miluimnikim":       "Reserve officers overwhelmingly demand inquiry — it is a core party motivation",
        "hadash_taal":       "Supports state inquiry and accountability",
        "raam":              "Supports accountability inquiry",
    },
    "q32": {
        "likud":             "Coalition with Haredi parties prevents enforcement of core curriculum in Haredi schools; has repeatedly backed down",
        "shas":              "Non-negotiable Haredi demand: yeshiva schools exempt from secular core curriculum",
        "utj":               "Core demand: Torah study institutions must not be forced to teach secular subjects",
        "otzma":             "Religious Zionist schools already teach core curriculum; not a priority for Ben-Gvir; allied with Haredim",
        "religious_zionism": "Smotrich allied with Haredim; opposes mandating secular curriculum in Haredi schools",
        "yesh_atid":         "Lapid has made mandatory core curriculum (math, English, sciences) a flagship issue for years",
        "national_unity":    "Supports core curriculum requirement; advanced it during Bennett government",
        "yashar":            "Kahana as Minister of Religious Services actively promoted core curriculum in Haredi schools",
        "bennett_2026":      "Bennett strongly promoted core curriculum as PM and as 2026 campaign theme: 'every child deserves an education'",
        "democrats":         "Strongly supports — core public education is a Labor/Meretz value",
        "yisrael_beitenu":   "Lieberman's SIGNATURE issue: ties all state funding to core curriculum compliance",
        "miluimnikim":       "Educated, capable workforce essential for military service — core curriculum is a prerequisite",
        "hadash_taal":       "Supports civic education standards while respecting cultural and linguistic rights of Arab schools",
        "raam":              "Arab schools already teach core curriculum; Ra'am focused on Arab education funding, not Haredi reform",
    },
    "q33": {
        "likud":             "Channel 14 functions as a pro-Netanyahu platform; strongly opposes tighter media regulation",
        "shas":              "Coalition; would oppose regulation that might target allied media outlets",
        "utj":               "Not a priority; neutral on commercial broadcast regulation",
        "otzma":             "Channel 14 strongly supports Ben-Gvir; strongly opposes regulation of commercial broadcasts",
        "religious_zionism": "Benefits from friendly media coverage; opposes stronger enforcement powers for regulators",
        "yesh_atid":         "Supports professional journalistic standards; concerned about Channel 14 disinformation",
        "national_unity":    "Supports media accountability standards and Broadcasting Authority enforcement powers",
        "yashar":            "Supports media professionalism and accountability for systematic factual distortion",
        "bennett_2026":      "Supports media standards; has spoken about media reform and accountability",
        "democrats":         "Strongly supports — Meretz/Labor have been vocal critics of Channel 14 disinformation",
        "yisrael_beitenu":   "Supports media accountability in principle; wary of government overreach in media",
        "miluimnikim":       "Supports professional media standards and preventing systematic disinformation",
        "hadash_taal":       "Strongly supports regulation — Arab communities feel targeted by biased and inciting media coverage",
        "raam":              "Supports accountability; concerned about systematic anti-Arab framing in coverage",
    },
}


def get_source(party: str, qid: str) -> str:
    return SOURCES_STATED[qid].get(party, "Party position")


def make_position(party: str, qid: str):
    stated, voted, div = POSITIONS[party][qid]
    is_yashar = party == "yashar"
    source_voted = SOURCE_PROXY if is_yashar else SOURCE_VOTED

    pos = {
        "question_id": qid,
        "stated_position": {
            "score": stated,
            "source": get_source(party, qid),
        },
    }
    if voted is not None:
        pos["voted_position"] = {
            "score": voted,
            "last_updated": TODAY,
            "source": source_voted,
        }
        gap = abs(stated - voted)
        pos["divergence_flag"] = gap > 1
    return pos


def main():
    for party, filepath in [(p, POSITIONS_DIR / f"{p}.json") for p in POSITIONS]:
        if not filepath.exists():
            print(f"  SKIP {party}: file not found")
            continue

        with open(filepath) as f:
            data = json.load(f)

        existing_qids = {p["question_id"] for p in data.get("positions", [])}
        added = 0
        for qid in ["q31", "q32", "q33"]:
            if qid not in existing_qids:
                data["positions"].append(make_position(party, qid))
                added += 1

        with open(filepath, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  {party}: added {added} questions")


if __name__ == "__main__":
    print("Adding q31, q32, q33 to all party files...")
    main()
    print("Done.")
