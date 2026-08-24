"""Fetch each entry's gameweek points from the FPL API, then compute per-team
round totals, round rankings and cumulative Classic-league standings.

Reads:  data/teams.json (static team assignment)
Writes: data/scores.json     (raw per-entry event points)
        data/standings.json  (per-round team totals/ranks + cumulative league table)

Usage:
    python scripts/fetch_scores.py
"""
import json
import sys
import time
from pathlib import Path

import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
TEAMS_PATH = ROOT / "data" / "teams.json"
SCORES_PATH = ROOT / "data" / "scores.json"
STANDINGS_PATH = ROOT / "data" / "standings.json"

HISTORY_URL = "https://fantasy.premierleague.com/api/entry/{entry_id}/history/"
REQUEST_DELAY = 0.4
MAX_RETRIES = 3
LEAGUE_POINTS_BY_RANK = {1: 10, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 0}


def fetch_entry_history(session, entry_id):
    url = HISTORY_URL.format(entry_id=entry_id)
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            if attempt == MAX_RETRIES:
                print(f"  ! Failed to fetch entry {entry_id} after {MAX_RETRIES} tries: {exc}")
                return None
            time.sleep(1.5 * attempt)
    return None


def build_scores(teams):
    session = requests.Session()
    session.headers.update({"User-Agent": "slna-fantasy-league-bot/1.0"})

    scores = {}
    all_entries = [entry for entries in teams.values() for entry in entries]
    for i, entry in enumerate(all_entries, start=1):
        entry_id = entry["entry_id"]
        print(f"[{i}/{len(all_entries)}] Fetching entry {entry_id} ({entry['entry_name']})...")
        data = fetch_entry_history(session, entry_id)
        event_points = {}
        total = 0
        if data:
            for gw in data.get("current", []):
                event_points[str(gw["event"])] = gw["points"]
                total = gw["total_points"]
        scores[str(entry_id)] = {"event_points": event_points, "total": total}
        time.sleep(REQUEST_DELAY)
    return scores


def assign_league_points(ranked_team_ids_desc):
    """Standard competition ranking: ties share the higher rank's points."""
    points = {}
    rank = 1
    prev_value = None
    for idx, (team_id, value) in enumerate(ranked_team_ids_desc, start=1):
        if value != prev_value:
            rank = idx
        points[team_id] = LEAGUE_POINTS_BY_RANK.get(rank, 0)
        prev_value = value
    return points


def compute_standings(teams, scores):
    team_ids = sorted(teams.keys(), key=int)

    # Determine which events have at least one recorded score.
    all_events = set()
    for entry_score in scores.values():
        all_events.update(entry_score["event_points"].keys())
    events = sorted(all_events, key=int)

    rounds = []
    cumulative_league_points = {tid: 0 for tid in team_ids}
    cumulative_raw_points = {tid: 0 for tid in team_ids}

    for event in events:
        team_round_points = {}
        for tid in team_ids:
            entries = teams[tid]
            round_total = 0
            complete = True
            for entry in entries:
                entry_score = scores.get(str(entry["entry_id"]), {})
                pts = entry_score.get("event_points", {}).get(event)
                if pts is None:
                    complete = False
                    continue
                round_total += pts
            team_round_points[tid] = round_total if complete else None

        # Only rank teams that have a complete round (all 4 entries reported).
        ranked = sorted(
            ((tid, pts) for tid, pts in team_round_points.items() if pts is not None),
            key=lambda kv: kv[1],
            reverse=True,
        )
        league_points = assign_league_points(ranked) if ranked else {}

        round_entry = {"event": int(event), "teams": {}}
        for tid in team_ids:
            raw = team_round_points[tid]
            lp = league_points.get(tid)
            if raw is not None:
                cumulative_raw_points[tid] += raw
            if lp is not None:
                cumulative_league_points[tid] += lp
            round_entry["teams"][tid] = {
                "round_points": raw,
                "league_points": lp,
                "cumulative_league_points": cumulative_league_points[tid],
                "cumulative_raw_points": cumulative_raw_points[tid],
            }
        rounds.append(round_entry)

    # Final standings table, sorted by cumulative league points desc,
    # tie-broken by cumulative raw points desc.
    table = sorted(
        team_ids,
        key=lambda tid: (cumulative_league_points[tid], cumulative_raw_points[tid]),
        reverse=True,
    )
    standings_table = [
        {
            "team_id": tid,
            "league_points": cumulative_league_points[tid],
            "raw_points": cumulative_raw_points[tid],
        }
        for tid in table
    ]

    return {
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "rounds": rounds,
        "standings": standings_table,
    }


def main():
    teams = json.loads(TEAMS_PATH.read_text(encoding="utf-8"))

    scores = build_scores(teams)
    SCORES_PATH.write_text(json.dumps(scores, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {SCORES_PATH}")

    standings = compute_standings(teams, scores)
    STANDINGS_PATH.write_text(json.dumps(standings, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {STANDINGS_PATH}")


if __name__ == "__main__":
    main()
