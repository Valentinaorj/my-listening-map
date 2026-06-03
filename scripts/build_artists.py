#!/usr/bin/env python3
"""
build_artists.py — My Listening Map
Generates data/artists.json from master_playlist_enriched.csv.

For each primary artist it records:
  - name
  - song_count
  - albums (sorted list)
  - country (first country from Artist Country field)
  - wikipedia_slug (best-guess Wikipedia page title, to be verified manually)
  - wikipedia_verified (False until you manually confirm it)

Run from the project root:
  python3 scripts/build_artists.py

Then open data/artists.json, review the wikipedia_slug column for bad matches,
and set wikipedia_verified: true for ones you've confirmed.
"""

import csv
import json
import urllib.request
import urllib.parse
import time
import sys
import os

INPUT_CSV  = "data/master_playlist_enriched.csv"
OUTPUT_JSON = "data/artists.json"

def parse_csv(path):
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("Track Name", "").strip():
                rows.append(row)
    return rows

def build_artist_map(rows):
    """Aggregate song/album/country data per primary artist."""
    artists = {}
    for row in rows:
        raw_artists = row.get("Artist Name(s)", "")
        # multi-artist: comma-separated, primary is first
        names = [a.strip() for a in raw_artists.split(",") if a.strip()]
        primary = names[0] if names else ""
        if not primary:
            continue

        country_raw = row.get("Artist Country", "")
        # country field uses '; ' as separator — take first
        country = country_raw.split(";")[0].strip() if country_raw else ""

        continent = row.get("Artist Continent", "").split(";")[0].strip()

        album = row.get("Album Name", "").strip()
        track = row.get("Track Name", "").strip()
        main_genre = row.get("Main Genre", "").strip()
        release_date = row.get("Release Date", "").strip()
        year = release_date[:4] if release_date else ""

        if primary not in artists:
            artists[primary] = {
                "name": primary,
                "song_count": 0,
                "albums": set(),
                "country": country,
                "continent": continent,
                "main_genres": set(),
                "years": set(),
                "wikipedia_slug": "",
                "wikipedia_verified": False,
            }

        artists[primary]["song_count"] += 1
        if album:
            artists[primary]["albums"].add(album)
        if main_genre:
            artists[primary]["main_genres"].add(main_genre)
        if year:
            artists[primary]["years"].add(year)
        # keep country from first song that has one
        if not artists[primary]["country"] and country:
            artists[primary]["country"] = country
        if not artists[primary]["continent"] and continent:
            artists[primary]["continent"] = continent

    return artists

def wikipedia_search(artist_name):
    """
    Query Wikipedia's search API for the best matching page title.
    Returns (slug, display_title) or ("", "") if nothing found.
    """
    # try exact title first
    query = urllib.parse.quote(artist_name)
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{query}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MyListeningMap/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            if data.get("type") != "disambiguation":
                return data.get("title", ""), data.get("title", "")
    except Exception:
        pass

    # fall back to search API
    search_url = (
        "https://en.wikipedia.org/w/api.php?action=query&list=search"
        "&srlimit=1&format=json&srsearch="
        + urllib.parse.quote(artist_name + " musician")
    )
    try:
        req = urllib.request.Request(search_url, headers={"User-Agent": "MyListeningMap/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            results = data.get("query", {}).get("search", [])
            if results:
                title = results[0]["title"]
                return title, title
    except Exception:
        pass

    return "", ""

def main():
    print(f"Reading {INPUT_CSV}...")
    rows = parse_csv(INPUT_CSV)
    print(f"  {len(rows)} tracks loaded")

    artists = build_artist_map(rows)
    print(f"  {len(artists)} unique primary artists found")

    # sort by song count descending
    sorted_artists = sorted(artists.values(), key=lambda a: -a["song_count"])

    # convert sets to sorted lists for JSON
    for a in sorted_artists:
        a["albums"]      = sorted(a["albums"])
        a["main_genres"] = sorted(a["main_genres"])
        a["years"]       = sorted(a["years"])

    # --- Wikipedia slug lookup ---
    # Only run if --wikipedia flag passed, otherwise skip (saves time)
    do_wikipedia = "--wikipedia" in sys.argv

    if do_wikipedia:
        print(f"\nLooking up Wikipedia slugs for {len(sorted_artists)} artists...")
        print("  (this takes a few minutes — rate limited to 1 req/sec)")
        for i, a in enumerate(sorted_artists):
            slug, title = wikipedia_search(a["name"])
            a["wikipedia_slug"] = slug
            a["wikipedia_verified"] = False
            if (i + 1) % 50 == 0:
                print(f"  {i+1}/{len(sorted_artists)} done...")
            time.sleep(1.0)  # be polite to Wikipedia
        print("  Wikipedia lookup complete.")
    else:
        print("\nSkipping Wikipedia lookup (pass --wikipedia to enable).")
        for a in sorted_artists:
            a["wikipedia_slug"] = ""
            a["wikipedia_verified"] = False

    # write output
    os.makedirs("data", exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(sorted_artists, f, ensure_ascii=False, indent=2)

    print(f"\nWrote {len(sorted_artists)} artists to {OUTPUT_JSON}")
    print("\nNext steps:")
    print("  1. Open data/artists.json")
    print("  2. For each entry, check wikipedia_slug — fix any wrong matches")
    print("  3. Set wikipedia_verified: true for confirmed entries")
    print("  4. The artists tab in the dashboard reads this file directly")

if __name__ == "__main__":
    main()
