import pandas as pd

df = pd.read_csv('data/master_playlist_enriched.csv')
genres = {}

for cell in df['Genres'].dropna():
    for g in cell.split(','):
        g = g.strip()
        if g:
            genres[g] = genres.get(g, 0) + 1

with open('genres_list.txt', 'w', encoding='utf-8') as f:
    for genre, count in sorted(genres.items(), key=lambda x: -x[1]):
        f.write(f'{count:4d}  {genre}\n')

print(f'Done! {len(genres)} unique genres written to genres_list.txt')