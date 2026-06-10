#!/usr/bin/env python3
"""
add_youtube_urls.py

Fetches a YouTube URL for every track in master_playlist_enriched.csv
using ytmusicapi (unauthenticated — no login required).

Adds a 'YouTube URL' column and overwrites the CSV in place.

Progress is checkpointed to youtube_checkpoint.json every 50 songs,
so it's safe to Ctrl+C and resume.

Estimated time: ~25–30 min for 2,200 songs at default rate.

Usage:
    pip install ytmusicapi
    python add_youtube_urls.py
"""

import csv
import json
import time
import sys
import os
import signal

# ── CONFIG ───────────────────────────────────────────────────────────────────
INPUT_CSV       = "data/master_playlist_enriched.csv"
OUTPUT_CSV      = "data/master_playlist_enriched.csv"   # overwrites in place
CHECKPOINT_FILE = "youtube_checkpoint.json"
SLEEP_BETWEEN   = 0.65   # seconds between requests — don't go below 0.5
SAVE_EVERY      = 50     # write checkpoint every N new requests

# ── SETUP ────────────────────────────────────────────────────────────────────
try:
    from ytmusicapi import YTMusic
except ImportError:
    print("ytmusicapi not installed.\nRun: pip install ytmusicapi")
    sys.exit(1)


def first_artist(artist_field: str) -> str:
    """Return the first artist from a '; '-delimited field."""
    return artist_field.split("; ")[0].strip() if artist_field else ""


def search_youtube(yt: YTMusic, track: str, artist: str) -> str:
    """
    Search YouTube Music for a track. Returns a youtube.com URL or ''.

    Strategy:
      1. filter='songs' — most likely to return the studio recording
      2. Fallback: unfiltered search (catches live albums, covers listed as songs)
    """
    query = f"{track} {artist}".strip()
    try:
        # Pass 1: songs filter
        results = yt.search(query, filter="songs", limit=2)
        for r in results:
            vid = r.get("videoId")
            if vid:
                return f"https://www.youtube.com/watch?v={vid}"

        # Pass 2: unfiltered (picks up videos, albums, etc.)
        results = yt.search(query, limit=2)
        for r in results:
            vid = r.get("videoId")
            if vid:
                return f"https://www.youtube.com/watch?v={vid}"

    except Exception as e:
        print(f"  ⚠  error · '{query}' → {e}")

    return ""


# ── LOAD CHECKPOINT ───────────────────────────────────────────────────────────
checkpoint: dict[str, str] = {}
if os.path.exists(CHECKPOINT_FILE):
    with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
        checkpoint = json.load(f)
    print(f"Resuming: {len(checkpoint)} songs already processed.\n")


def save_checkpoint():
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(checkpoint, f, ensure_ascii=False, indent=2)


# Save checkpoint on Ctrl+C so progress isn't lost
def handle_interrupt(sig, frame):
    print("\n\nInterrupted — saving checkpoint...")
    save_checkpoint()
    print(f"Saved {len(checkpoint)} entries to {CHECKPOINT_FILE}. Safe to resume.")
    sys.exit(0)

signal.signal(signal.SIGINT, handle_interrupt)


# ── READ CSV ──────────────────────────────────────────────────────────────────
with open(INPUT_CSV, "r", encoding="utf-8", newline="") as f:
    reader    = csv.DictReader(f)
    fieldnames = list(reader.fieldnames)
    rows       = list(reader)

# Add column if not already present
if "YouTube URL" not in fieldnames:
    fieldnames.append("YouTube URL")

# Seed checkpoint from any URLs already in the CSV
for row in rows:
    uri = row.get("Track URI", "")
    existing_url = row.get("YouTube URL", "").strip()
    if uri and existing_url and uri not in checkpoint:
        checkpoint[uri] = existing_url


# ── PROCESS ───────────────────────────────────────────────────────────────────
yt    = YTMusic()
total = len(rows)
new_requests = 0
not_found    = 0

print(f"{'─'*55}")
print(f"Tracks in CSV : {total}")
print(f"Pre-processed : {len(checkpoint)}")
print(f"Still to do   : {total - len(checkpoint)}")
print(f"{'─'*55}\n")

for i, row in enumerate(rows):
    uri    = row.get("Track URI", "")
    track  = row.get("Track Name", "").strip()
    artist = first_artist(row.get("Artist Name(s)", ""))

    # Already done — just apply and move on
    if uri in checkpoint:
        row["YouTube URL"] = checkpoint[uri]
        continue

    # New request
    url = search_youtube(yt, track, artist)
    row["YouTube URL"] = url
    checkpoint[uri]    = url
    new_requests      += 1

    status = "✓" if url else "✗"
    if not url:
        not_found += 1

    # Progress line — only for new requests to keep output readable
    pct = f"{(i + 1) / total * 100:.1f}%"
    print(f"[{i+1:>4}/{total}] {pct}  {status}  {track[:40]:<40}  {artist[:25]}")

    time.sleep(SLEEP_BETWEEN)

    # Periodic checkpoint
    if new_requests % SAVE_EVERY == 0:
        save_checkpoint()
        print(f"\n  💾 checkpoint saved ({len(checkpoint)} total)\n")

# ── FINAL SAVE ────────────────────────────────────────────────────────────────
save_checkpoint()

# ── WRITE CSV ─────────────────────────────────────────────────────────────────
with open(OUTPUT_CSV, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(
        f, fieldnames=fieldnames,
        quoting=csv.QUOTE_ALL,
        extrasaction="ignore"
    )
    writer.writeheader()
    writer.writerows(rows)

# ── SUMMARY ───────────────────────────────────────────────────────────────────
found = sum(1 for r in rows if r.get("YouTube URL", "").strip())
print(f"\n{'─'*55}")
print(f"Done.")
print(f"  ✓  URL found   : {found} / {total}")
print(f"  ✗  Not found   : {total - found}")
print(f"  💾 Output      : {OUTPUT_CSV}")
print(f"  📍 Checkpoint  : {CHECKPOINT_FILE}")
print(f"{'─'*55}")
