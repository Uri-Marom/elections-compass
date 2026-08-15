#!/usr/bin/env python3
"""Download party logos from Wikipedia to public/logos/"""
import os
import time
import urllib.request
import urllib.parse

LOGOS = {
    "likud":             "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Likud_Logo.svg/250px-Likud_Logo.svg.png",
    "shas":              "https://upload.wikimedia.org/wikipedia/en/thumb/0/05/Shas_logo.svg/250px-Shas_logo.svg.png",
    "utj":               "https://upload.wikimedia.org/wikipedia/he/thumb/9/97/%D7%99%D7%94%D7%93%D7%95%D7%AA_%D7%94%D7%AA%D7%95%D7%A8%D7%94_%D7%9C%D7%95%D7%92%D7%95_2019.svg/250px-%D7%99%D7%94%D7%93%D7%95%D7%AA_%D7%94%D7%AA%D7%95%D7%A8%D7%94_%D7%9C%D7%95%D7%92%D7%95_2019.svg.png",
    "otzma":             "https://upload.wikimedia.org/wikipedia/he/thumb/9/9f/%D7%A2%D7%95%D7%A6%D7%9E%D7%94_%D7%99%D7%94%D7%95%D7%93%D7%99%D7%AA_%D7%9C%D7%95%D7%92%D7%95_2021.svg/250px-%D7%A2%D7%95%D7%A6%D7%9E%D7%94_%D7%99%D7%94%D7%95%D7%93%D7%99%D7%AA_%D7%9C%D7%95%D7%92%D7%95_2021.svg.png",
    "religious_zionism": "https://upload.wikimedia.org/wikipedia/en/thumb/2/24/Religious_Zionist_party_logo_2022.svg/250px-Religious_Zionist_party_logo_2022.svg.png",
    "beyachad":          "https://upload.wikimedia.org/wikipedia/he/thumb/1/12/%D7%99%D7%A9_%D7%A2%D7%AA%D7%99%D7%93_%D7%9C%D7%95%D7%92%D7%95.svg/250px-%D7%99%D7%A9_%D7%A2%D7%AA%D7%99%D7%93_%D7%9C%D7%95%D7%92%D7%95.svg.png",
    "national_unity":    "https://upload.wikimedia.org/wikipedia/he/thumb/a/a6/%D7%9C%D7%95%D7%92%D7%95_%D7%9B%D7%97%D7%95%D7%9C_%D7%9C%D7%91%D7%9F_2021.svg/250px-%D7%9C%D7%95%D7%92%D7%95_%D7%9B%D7%97%D7%95%D7%9C_%D7%9C%D7%91%D7%9F_2021.svg.png",
    "yashar":            "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Yashar_party_logo.png/250px-Yashar_party_logo.png",
    "democrats":         "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/The_Democrats_led_by_Yair_Golan.svg/250px-The_Democrats_led_by_Yair_Golan.svg.png",
    "yisrael_beitenu":   "https://upload.wikimedia.org/wikipedia/he/thumb/a/a4/%D7%9C%D7%95%D7%92%D7%95_%D7%99%D7%A9%D7%A8%D7%90%D7%9C_%D7%91%D7%99%D7%AA%D7%A0%D7%95_2022.svg/250px-%D7%9C%D7%95%D7%92%D7%95_%D7%99%D7%A9%D7%A8%D7%90%D7%9C_%D7%91%D7%99%D7%AA%D7%A0%D7%95_2022.svg.png",
    "miluimnikim":       "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/%D7%94%D7%9E%D7%99%D7%9C%D7%95%D7%90%D7%99%D7%9E%D7%A0%D7%99%D7%A7%D7%99%D7%9D_%D7%9C%D7%95%D7%92%D7%95_%D7%95%D7%95%D7%99%D7%A7%D7%99%D7%A4%D7%93%D7%99%D7%94.jpg/250px-%D7%94%D7%9E%D7%99%D7%9C%D7%95%D7%90%D7%99%D7%9E%D7%A0%D7%99%D7%A7%D7%99%D7%9D_%D7%9C%D7%95%D7%92%D7%95_%D7%95%D7%95%D7%99%D7%A7%D7%99%D7%A4%D7%93%D7%99%D7%94.jpg",
    "hadash_taal":       "https://upload.wikimedia.org/wikipedia/he/thumb/e/eb/%D7%9C%D7%95%D7%92%D7%95_%D7%97%D7%93%22%D7%A9-%D7%AA%D7%A2%22%D7%9C_2022_%28%D7%A2%D7%91%D7%A8%D7%99%D7%AA%29.svg/250px-%D7%9C%D7%95%D7%92%D7%95_%D7%97%D7%93%22%D7%A9-%D7%AA%D7%A2%22%D7%9C_2022_%28%D7%A2%D7%91%D7%A8%D7%99%D7%AA%29.svg.png",
    "raam":              "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Raam_logo_2021.svg/250px-Raam_logo_2021.svg.png",
    "balad":             "https://upload.wikimedia.org/wikipedia/he/thumb/1/19/Balad.svg/250px-Balad.svg.png",
    # achdut (Erdan–Edelstein, founded Aug 2026): no logo on Wikipedia yet — parties.json carries logo: null
}

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'logos')
os.makedirs(OUT_DIR, exist_ok=True)

headers = {'User-Agent': 'Mozilla/5.0 (compatible; elections-tool-bot/1.0)'}

for party_id, url in LOGOS.items():
    ext = '.jpg' if url.endswith('.jpg') else '.png'
    dest = os.path.join(OUT_DIR, f"{party_id}{ext}")
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        with open(dest, 'wb') as f:
            f.write(data)
        print(f"  ✓  {party_id}  ({len(data)//1024}KB)")
    except Exception as e:
        print(f"  ✗  {party_id}: {e}")
    time.sleep(2)
