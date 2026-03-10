import pandas as pd
import requests
import time
import pycountry
import country_converter as coco
import os

INPUT_FILE = "master_playlist.csv"
OUTPUT_FILE = "master_playlist_enriched.csv"
CACHE_FILE = "artist_cache.csv"

HEADERS = {"User-Agent": "SpotifyDashboard/1.0 (valentina@example.com)"}


def get_artist_country(artist_name):
    """Look up an artist in MusicBrainz and return (country_name, continent)."""
    url = f"https://musicbrainz.org/ws/2/artist?query=artist:{artist_name}&fmt=json"
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return None, None
        data = r.json()
        if "artists" in data and data["artists"]:
            country_code = data["artists"][0].get("country")
            if country_code:
                try:
                    country_name = pycountry.countries.get(alpha_2=country_code).name
                except:
                    country_name = country_code
                try:
                    continent = coco.convert(names=country_code, to="continent", not_found=None)
                except:
                    continent = None
                return country_name, continent
    except Exception as e:
        print(f"⚠️ Error fetching {artist_name}: {e}")
    return None, None


def process_artists(artist_field, cache):
    """
    Handle multiple artists separated by commas.
    Uses cache to avoid duplicate lookups.
    """
    if pd.isna(artist_field):
        return None, None

    artists = [a.strip() for a in str(artist_field).split(",")]
    countries, continents = [], []

    for artist in artists:
        if artist in cache:
            country, continent = cache[artist]
        else:
            country, continent = get_artist_country(artist)
            cache[artist] = (country if country else "Unknown", continent if continent else "Unknown")
            time.sleep(1)  # respect MusicBrainz rate limit
        countries.append(country if country else "Unknown")
        continents.append(continent if continent else "Unknown")

    return "; ".join(countries), "; ".join(continents)


def main():
    print(f"📂 Loading {INPUT_FILE}...")
    df = pd.read_csv(INPUT_FILE)

    artist_col = "Artist Name(s)"
    unique_artists = df[artist_col].dropna().unique()
    print(f"Found {len(unique_artists)} unique artist entries (some may contain multiple names)")

    # Load cache if it exists
    if os.path.exists(CACHE_FILE):
        cache_df = pd.read_csv(CACHE_FILE)
        cache = {row["Artist"]: (row["Country"], row["Continent"]) for _, row in cache_df.iterrows()}
        print(f"✅ Loaded {len(cache)} cached artists")
    else:
        cache = {}

    results = {}

    for i, artist_entry in enumerate(unique_artists, 1):
        if artist_entry in results:
            continue
        countries, continents = process_artists(artist_entry, cache)
        results[artist_entry] = {"Artist Country": countries, "Artist Continent": continents}
        print(f"[{i}/{len(unique_artists)}] {artist_entry} → {countries}, {continents}")

    # Save updated cache
    cache_df = pd.DataFrame(
        [{"Artist": k, "Country": v[0], "Continent": v[1]} for k, v in cache.items()]
    )
    cache_df.to_csv(CACHE_FILE, index=False)
    print(f"💾 Saved cache with {len(cache)} artists → {CACHE_FILE}")

    # Merge results back into DataFrame
    enrich_df = pd.DataFrame.from_dict(results, orient="index")
    df = df.merge(enrich_df, left_on=artist_col, right_index=True, how="left")

    print(f"💾 Saving enriched data to {OUTPUT_FILE}")
    df.to_csv(OUTPUT_FILE, index=False)
    print("✅ Done!")


if __name__ == "__main__":
    main()
