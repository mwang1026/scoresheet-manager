# Data Directory

This directory holds CSV files for importing player data and projections.

## Files to Place Here

- `scoresheet-players.csv` — Player roster from Scoresheet.com
- `pecota-projections.csv` — PECOTA projections data

## Usage

Import scripts in `backend/app/scripts/` read from this directory:

```bash
# Import teams (reads from frontend fixtures)
python -m app.scripts.import_teams

# Import players
python -m app.scripts.import_players ../data/scoresheet-players.csv

# Import projections
python -m app.scripts.import_projections ../data/pecota-projections.csv --source PECOTA
```

## Gitignore

CSV files in this directory are gitignored to avoid committing large datasets.
Only this README and `.gitkeep` are tracked.
