const express = require('express');
const mysql = require('mysql2');
require('dotenv').config();

const app = express();
const port = 3000;

app.set('view engine', 'ejs');

const db = mysql.createPool({
    host: process.env.TIDB_HOST,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE || 'test',
    port: 4000,
    ssl: { minVersion: 'TLSv1.2' },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

app.get('/', (req, res) => {
    const sqlGames = 'SELECT * FROM dodgers_games ORDER BY game_date DESC';
    const sqlStats = 'SELECT * FROM player_stats LIMIT 1';
    const sqlStandings = 'SELECT * FROM team_standings LIMIT 1';
    const sqlRoster = 'SELECT * FROM dodgers_roster ORDER BY CAST(jersey_number AS UNSIGNED) ASC';

    db.query(sqlGames, (err, gamesResults) => {
        if (err) return res.status(500).send('DBエラー(試合)');
        db.query(sqlStats, (err, statsResults) => {
            if (err) return res.status(500).send('DBエラー(成績)');
            db.query(sqlStandings, (err, standingsResults) => {
                if (err) return res.status(500).send('DBエラー(チーム成績)');
                db.query(sqlRoster, (err, rosterResults) => {
                    if (err) return res.status(500).send('DBエラー(メンバー)');

                    // 4つのデータを全部EJSへ受け渡す！
                    res.render('index', {
                        games: gamesResults,
                        ohtani: statsResults[0],
                        standings: standingsResults[0],
                        roster: rosterResults
                    });
                });
            });
        });
    });
});

app.listen(port, () => {
    console.log(`🚀 ダッシュボードが起動したよ！ http://localhost:${port}`);
});