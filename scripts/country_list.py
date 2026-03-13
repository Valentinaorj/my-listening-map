import pandas as pd

df = pd.read_csv('data/master_playlist_enriched.csv')
countries = {}

for cell in df['Artist Country'].dropna():
    for g in cell.split(','):
        g = g.strip()
        if g:
            countries[g] = countries.get(g, 0) + 1

with open('countries_list.txt', 'w', encoding='utf-8') as f:
    for genre, count in sorted(countries.items(), key=lambda x: -x[1]):
        f.write(f'{count:4d}  {genre}\n')

print(f'Done! {len(countries)} unique countries written to countries_list.txt')