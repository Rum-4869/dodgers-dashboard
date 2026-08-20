import requests
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

print("⚾️ MLB APIからドジャースの全データを取得中...\n")

import datetime
current_year = datetime.datetime.now().year
games_url = f"https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=119&season={current_year}"
games_data = requests.get(games_url).json()

ohtani_url = "https://statsapi.mlb.com/api/v1/people/660271?hydrate=stats(group=[hitting],type=[season])"
ohtani_data = requests.get(ohtani_url).json()
ohtani_info = ohtani_data["people"][0]
ohtani_stats = ohtani_info["stats"][0]["splits"][0]["stat"]

standings_url = "https://statsapi.mlb.com/api/v1/standings?leagueId=104"
standings_data = requests.get(standings_url).json()
team_wins = team_losses = 0
team_pct = ".000"
team_rank = "1"
for record in standings_data.get("records", []):
    for team_record in record.get("teamRecords", []):
        if team_record["team"]["id"] == 119:
            team_wins = team_record["wins"]
            team_losses = team_record["losses"]
            team_pct = team_record["winningPercentage"]
            team_rank = team_record["divisionRank"]

roster_url = "https://statsapi.mlb.com/api/v1/teams/119/roster"
roster_data = requests.get(roster_url).json()
roster_list = roster_data.get("roster", [])

try:
    connection = pymysql.connect(
        host=os.getenv("TIDB_HOST"),
        user=os.getenv("TIDB_USER"),
        password=os.getenv("TIDB_PASSWORD"),
        database=os.getenv("TIDB_DATABASE", "test"),
        port=4000,
        ssl={"ssl": {}}
    )
    cursor = connection.cursor()

    cursor.execute("DROP TABLE IF EXISTS dodgers_games")
    cursor.execute("CREATE TABLE dodgers_games (id INT AUTO_INCREMENT PRIMARY KEY, game_date DATE, game_datetime VARCHAR(30), away_team VARCHAR(50), away_score INT, home_team VARCHAR(50), home_score INT, status VARCHAR(20))")
    cursor.execute("CREATE TABLE IF NOT EXISTS player_stats (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50), avg VARCHAR(10), hr INT, rbi INT, ops VARCHAR(10), sb INT)")
    cursor.execute("CREATE TABLE IF NOT EXISTS team_standings (id INT AUTO_INCREMENT PRIMARY KEY, wins INT, losses INT, pct VARCHAR(10), division_rank VARCHAR(10))")
    
    # 🌟 ここが変更点！一度テーブルを消して、player_idを追加して作り直す！
    cursor.execute("DROP TABLE IF EXISTS dodgers_roster")
    cursor.execute("CREATE TABLE dodgers_roster (id INT AUTO_INCREMENT PRIMARY KEY, player_id INT, name VARCHAR(100), jersey_number VARCHAR(10), position VARCHAR(20))")

    # dodgers_games was dropped above
    cursor.execute("TRUNCATE TABLE player_stats")
    cursor.execute("TRUNCATE TABLE team_standings")

    cursor.execute("INSERT INTO player_stats (name, avg, hr, rbi, ops, sb) VALUES (%s, %s, %s, %s, %s, %s)", (ohtani_info["fullName"], ohtani_stats["avg"], ohtani_stats["homeRuns"], ohtani_stats["rbi"], ohtani_stats["ops"], ohtani_stats["stolenBases"]))
    cursor.execute("INSERT INTO team_standings (wins, losses, pct, division_rank) VALUES (%s, %s, %s, %s)", (team_wins, team_losses, team_pct, team_rank))

    # 🌟 選手ID (p_id) もTiDBに保存するよ！
    for item in roster_list:
        p_id = item["person"]["id"]
        p_name = item["person"]["fullName"]
        p_num = item.get("jerseyNumber", "-")
        p_pos = item["position"]["abbreviation"]
        cursor.execute(
            "INSERT INTO dodgers_roster (player_id, name, jersey_number, position) VALUES (%s, %s, %s, %s)",
            (p_id, p_name, p_num, p_pos)
        )

    for date_info in games_data.get("dates", []):
        for game in date_info.get("games", []):
            status = game.get("status", {}).get("abstractGameState")
            date = game.get("officialDate")
            game_datetime = game.get("gameDate")
            away_team = game["teams"]["away"]["team"]["name"]
            away_score = game["teams"]["away"].get("score", 0)
            home_team = game["teams"]["home"]["team"]["name"]
            home_score = game["teams"]["home"].get("score", 0)
            cursor.execute("INSERT INTO dodgers_games (game_date, game_datetime, away_team, away_score, home_team, home_score, status) VALUES (%s, %s, %s, %s, %s, %s, %s)", (date, game_datetime, away_team, away_score, home_team, home_score, status))

    connection.commit()
    connection.close()
    print("🎉 選手のIDを追加してデータ保存完了したよ！！")

except Exception as e:
    print(f"⚠️ エラー: {e}")