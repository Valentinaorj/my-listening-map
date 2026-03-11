import pandas as pd
import requests
import time

INPUT_FILE = "data/master_playlist_enriched.csv"
OUTPUT_FILE = "data/master_playlist_gender.csv"

def get_first_name(artist):
    """Extract first name from artist string, return None if it looks like a band."""
    # if multiple artists, take the first one
    artist = artist.split(",")[0].strip()
    
    # if more than 3 words, probably a band name
    words = artist.split()
    if len(words) > 3:
        return None, "band"
    
    # if all caps or contains &, probably a band
    if "&" in artist or artist.isupper():
        return None, "band"
    
    return words[0], None


def genderize(names):
    """Call genderize.io API with a batch of names."""
    url = "https://api.genderize.io"
    params = [("name[]", name) for name in names]
    try:
        r = requests.get(url, params=params, timeout=10)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f"Error: {e}")
    return []


def main():
    print("Loading data...")
    df = pd.read_csv(INPUT_FILE)
    
    # get unique artist entries
    unique_artists = df["Artist Name(s)"].dropna().unique()
    print(f"Found {len(unique_artists)} unique artist entries")
    
    results = {}
    batch = []
    batch_artists = []
    
    for artist in unique_artists:
        first_name, override = get_first_name(artist)
        
        if override == "band":
            results[artist] = "band"
            continue
            
        if first_name:
            batch.append(first_name)
            batch_artists.append(artist)
            
        # process in batches of 10 (genderize.io limit)
        if len(batch) >= 10:
            response = genderize(batch)
            for i, item in enumerate(response):
                gender = item.get("gender")
                prob = item.get("probability", 0)
                if gender and prob > 0.7:
                    results[batch_artists[i]] = gender
                else:
                    results[batch_artists[i]] = "unknown"
            batch = []
            batch_artists = []
            time.sleep(1)
    
    # process remaining batch
    if batch:
        response = genderize(batch)
        for i, item in enumerate(response):
            gender = item.get("gender")
            prob = item.get("probability", 0)
            if gender and prob > 0.7:
                results[batch_artists[i]] = gender
            else:
                results[batch_artists[i]] = "unknown"
    
    # map results back to dataframe
    df["Artist Gender"] = df["Artist Name(s)"].map(results).fillna("unknown")
    
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"Done! Saved to {OUTPUT_FILE}")
    print(df["Artist Gender"].value_counts())


if __name__ == "__main__":
    main()