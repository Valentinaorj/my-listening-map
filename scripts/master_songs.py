import pandas as pd
import glob
import os

# Path where your playlist CSVs live
PLAYLIST_DIR = "spotify_playlists"  # adjust this if needed

files = glob.glob(os.path.join(PLAYLIST_DIR, "*.csv"))
print(f"Looking in: {PLAYLIST_DIR}")
print(f"Found {len(files)} CSV files")

dfs = []

for f in files:
    try:
        # Let pandas sniff the delimiter (; or ,)
        df = pd.read_csv(f, sep=None, engine="python")
        df["playlist_name"] = os.path.basename(f).replace(".csv", "")
        dfs.append(df)
        print(f"✅ Loaded {os.path.basename(f)} with {len(df)} rows")
    except Exception as e:
        print(f"❌ Failed to read {os.path.basename(f)}: {e}")

if not dfs:
    raise ValueError("No playlists loaded — check your files!")

# Combine all playlists
all_songs = pd.concat(dfs, ignore_index=True)

# Columns to define a unique song
track_col = "Track Name"
artist_col = "Artist Name(s)"

# Build a unique ID for each song (case-insensitive, trimmed)
all_songs["unique_id"] = (
    all_songs[track_col].str.lower().str.strip()
    + " - "
    + all_songs[artist_col].str.lower().str.strip()
)

# Count how many playlists each song appears in
playlist_counts = (
    all_songs.groupby("unique_id")["playlist_name"]
    .nunique()
    .reset_index()
    .rename(columns={"playlist_name": "playlist_count"})
)

# Collect all playlist names for each song
playlist_lists = (
    all_songs.groupby("unique_id")["playlist_name"]
    .apply(lambda x: ", ".join(sorted(set(x))))
    .reset_index()
    .rename(columns={"playlist_name": "playlist_names"})
)

# Drop duplicates to keep only one copy of each unique song
unique_songs = all_songs.drop_duplicates(subset=["unique_id"]).copy()

# Merge playlist counts and names
master = (
    unique_songs
    .merge(playlist_counts, on="unique_id", how="left")
    .merge(playlist_lists, on="unique_id", how="left")
)

# Drop helper column
master.drop(columns=["unique_id"], inplace=True)

# Save result
output_file = "master_playlist.csv"
master.to_csv(output_file, index=False)

print(f"\n✅ Master playlist saved as {output_file}")
print(f"Total unique songs: {len(master)}")
