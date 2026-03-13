import pandas as pd

df = pd.read_csv('data/master_playlist_enriched.csv')

def fix_genres(cell):
    if pd.isna(cell):
        return cell
    genres = [g.strip() for g in cell.split(',')]
    fixed = []
    for g in genres:
        if g == 'electronica latino':
            g = 'electronica latina'
    fixed.append(g)
    # remove duplicates while preserving order
    seen = set()
    result = []
    for g in fixed:
        if g not in seen:
            seen.add(g)
            result.append(g)
    return ','.join(result)

df['Genres'] = df['Genres'].apply(fix_genres)
df.to_csv('data/master_playlist_enriched.csv', index=False)
print('Done!')