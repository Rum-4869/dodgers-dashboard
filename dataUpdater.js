const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateDodgersData() {
    console.log("⚾️ MLB APIからドジャースの全データを取得中 (Node.js Auto-Updater)...");
    
    try {
        const currentYear = new Date().getFullYear();
        
        // 1. Fetch Schedule
        const gamesUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=119&season=${currentYear}&hydrate=probablePitcher`;
        const gamesRes = await fetch(gamesUrl);
        const gamesData = await gamesRes.json();
        
        // 2. Fetch Ohtani
        const ohtaniUrl = "https://statsapi.mlb.com/api/v1/people/660271?hydrate=stats(group=[hitting],type=[season])";
        const ohtaniRes = await fetch(ohtaniUrl);
        const ohtaniData = await ohtaniRes.json();
        const ohtaniInfo = ohtaniData.people[0];
        const ohtaniStats = ohtaniInfo.stats[0].splits[0].stat;
        
        // 3. Fetch Standings
        const standingsUrl = "https://statsapi.mlb.com/api/v1/standings?leagueId=104";
        const standingsRes = await fetch(standingsUrl);
        const standingsData = await standingsRes.json();
        
        let teamWins = 0, teamLosses = 0, teamPct = ".000", teamRank = "1";
        const records = standingsData.records || [];
        for (const record of records) {
            for (const teamRecord of record.teamRecords || []) {
                if (teamRecord.team.id === 119) {
                    teamWins = teamRecord.wins;
                    teamLosses = teamRecord.losses;
                    teamPct = teamRecord.winningPercentage;
                    teamRank = teamRecord.divisionRank;
                }
            }
        }
        
        // 4. Fetch Roster
        const rosterUrl = "https://statsapi.mlb.com/api/v1/teams/119/roster";
        const rosterRes = await fetch(rosterUrl);
        const rosterData = await rosterRes.json();
        const rosterList = rosterData.roster || [];
        
        // --- DB Update ---
        const connection = await mysql.createConnection({
            host: process.env.TIDB_HOST,
            user: process.env.TIDB_USER,
            password: process.env.TIDB_PASSWORD,
            database: process.env.TIDB_DATABASE || 'test',
            port: 4000,
            ssl: { rejectUnauthorized: true } // TiDB requires SSL
        });
        
        console.log("DB connected for update.");
        
        await connection.execute("DROP TABLE IF EXISTS dodgers_games");
        await connection.execute("CREATE TABLE dodgers_games (id INT AUTO_INCREMENT PRIMARY KEY, game_pk INT, game_date DATE, game_datetime VARCHAR(30), away_team VARCHAR(50), away_score INT, home_team VARCHAR(50), home_score INT, status VARCHAR(20), away_pitcher VARCHAR(100), home_pitcher VARCHAR(100))");
        
        await connection.execute("CREATE TABLE IF NOT EXISTS player_stats (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50), avg VARCHAR(10), hr INT, rbi INT, ops VARCHAR(10), sb INT)");
        await connection.execute("CREATE TABLE IF NOT EXISTS team_standings (id INT AUTO_INCREMENT PRIMARY KEY, wins INT, losses INT, pct VARCHAR(10), division_rank VARCHAR(10))");
        
        await connection.execute("DROP TABLE IF EXISTS dodgers_roster");
        await connection.execute("CREATE TABLE dodgers_roster (id INT AUTO_INCREMENT PRIMARY KEY, player_id INT, name VARCHAR(100), jersey_number VARCHAR(10), position VARCHAR(20))");
        
        await connection.execute("TRUNCATE TABLE player_stats");
        await connection.execute("TRUNCATE TABLE team_standings");
        
        await connection.execute(
            "INSERT INTO player_stats (name, avg, hr, rbi, ops, sb) VALUES (?, ?, ?, ?, ?, ?)", 
            [ohtaniInfo.fullName, ohtaniStats.avg, ohtaniStats.homeRuns, ohtaniStats.rbi, ohtaniStats.ops, ohtaniStats.stolenBases]
        );
        
        await connection.execute(
            "INSERT INTO team_standings (wins, losses, pct, division_rank) VALUES (?, ?, ?, ?)",
            [teamWins, teamLosses, teamPct, teamRank]
        );
        
        for (const item of rosterList) {
            const pId = item.person.id;
            const pName = item.person.fullName;
            const pNum = item.jerseyNumber || "-";
            const pPos = item.position.abbreviation;
            await connection.execute(
                "INSERT INTO dodgers_roster (player_id, name, jersey_number, position) VALUES (?, ?, ?, ?)",
                [pId, pName, pNum, pPos]
            );
        }
        
        for (const dateInfo of gamesData.dates || []) {
            for (const game of dateInfo.games || []) {
                const status = game.status?.abstractGameState;
                const date = game.officialDate;
                const gameDatetime = game.gameDate;
                const awayTeam = game.teams.away.team.name;
                const awayScore = game.teams.away.score || 0;
                const homeTeam = game.teams.home.team.name;
                const homeScore = game.teams.home.score || 0;
                
                const gamePk = game.gamePk;
                const awayPitcher = game.teams.away.probablePitcher?.fullName || "";
                const homePitcher = game.teams.home.probablePitcher?.fullName || "";
                
                await connection.execute(
                    "INSERT INTO dodgers_games (game_pk, game_date, game_datetime, away_team, away_score, home_team, home_score, status, away_pitcher, home_pitcher) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [gamePk, date, gameDatetime, awayTeam, awayScore, homeTeam, homeScore, status, awayPitcher, homePitcher]
                );
            }
        }
        
        await connection.end();
        console.log("🎉 自動データ更新完了！");
        
    } catch (error) {
        console.error("⚠️ 自動更新エラー:", error);
    }
}

module.exports = updateDodgersData;
