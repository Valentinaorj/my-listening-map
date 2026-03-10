import pandas as pd
import glob
import os

print(">>> Hello, I am running the right file!")

# Path to folder containing all playlist CSVs
folder_path = os.path.join(os.getcwd(), "spotify_playlists")
print("Looking in:", folder_path)

# Get all CSV files in that folder
csv_files = glob.glob(os.path.join(folder_path, "*.csv"))
print(f"Found {len(csv_files)} CSV files")

# Read and combine
df_list = []
for f in csv_files:
    print(f"Reading {f}...")
    df_list.append(pd.read_csv(f, sep=";"))

df = pd.concat(df_list, ignore_index=True)
print(f"Combined {len(df)} rows before dropping duplicates")

# Drop duplicates based on Track URI (unique song ID)
df = df.drop_duplicates(subset=["Track URI"])
print(f"{len(df)} rows after dropping duplicates")

# Save master CSV
df.to_csv("master_songs.csv", index=False)
print("✅ Master CSV saved as master_songs.csv")
