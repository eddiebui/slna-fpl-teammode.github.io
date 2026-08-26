"""One-off script: convert the source CSV (entry list + team assignment) into
data/teams.json, the static config the rest of the system reads from.

Usage:
    python scripts/convert_csv_to_teams.py
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "SLNA Fantasy PL 2026-2027 - Copy of Team mode 1.csv"
OUT_PATH = ROOT / "data" / "teams.json"

TEAM_NAMES = {
    "0": "Team X",
    "1": "Rùa Pro Max",
    "2": "Cu Đơ",
    "3": "Đông Phương Thất Bại",
    "4": "Đội Bốn Cục Tạ",
    "5": "Liên Đoàn Ớt",
    "6": "Hốc Mút",
    "7": "VLC",
    "8": "Bùi Za và Gà Jin",
    "9": "Tài Đức Bắc Son Hên Lộc",
}


def main():
    teams = {}
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            team_id = row["Team"].strip()
            entry = {
                "entry_id": int(row["entry"]),
                "entry_name": row["entry_name"].strip(),
                "manager": f"{row['player_first_name'].strip()} {row['player_last_name'].strip()}".strip(),
            }
            teams.setdefault(team_id, []).append(entry)

    ordered = {
        team_id: {
            "name": TEAM_NAMES.get(team_id, f"Team {team_id}"),
            "entries": teams[team_id],
        }
        for team_id in sorted(teams, key=int)
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False, indent=2)

    print(f"Wrote {OUT_PATH} ({len(ordered)} teams, "
          f"{sum(len(v['entries']) for v in ordered.values())} entries)")


if __name__ == "__main__":
    main()
