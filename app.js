const express = require('express');
const mysql = require('mysql2/promise');
require('dotenv').config();
const Parser = require('rss-parser');
const parser = new Parser();

const updateDodgersData = require('./dataUpdater');

const app = express();
let cachedNews = [];

// 定期的にニュースを取得
async function fetchNews() {
    try {
        const feed = await parser.parseURL('https://www.mlb.com/dodgers/feeds/news/rss.xml');
        // 最新の5件をキャッシュ
        cachedNews = feed.items.slice(0, 5).map(item => ({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            contentSnippet: item.contentSnippet
        }));
        console.log(`📰 ニュースを更新しました: ${cachedNews.length}件`);
    } catch (error) {
        console.error('⚠️ ニュース取得エラー:', error);
    }
}
fetchNews(); // 初回実行
setInterval(fetchNews, 60 * 60 * 1000); // 1時間ごとに更新
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));

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

app.get('/', async (req, res) => {
    const sqlGames = 'SELECT * FROM dodgers_games ORDER BY game_date ASC';
    const sqlStats = 'SELECT * FROM player_stats LIMIT 1';
    const sqlStandings = 'SELECT * FROM team_standings LIMIT 1';
    const sqlRoster = 'SELECT * FROM dodgers_roster ORDER BY CAST(jersey_number AS UNSIGNED) ASC';

    try {
        const [gamesResults] = await db.execute(sqlGames);
        const [statsResults] = await db.execute(sqlStats);
        const [standingsResults] = await db.execute(sqlStandings);
        const [rosterResults] = await db.execute(sqlRoster);

        res.render('index', {
            games: gamesResults,
            stats: statsResults[0],
            standings: standingsResults[0],
            roster: rosterResults,
            news: cachedNews
        });
    } catch (err) {
        res.status(500).send('DB Error: ' + err.message);
    }
});

app.listen(port, () => {
    console.log(`⚾️ Dodgers Dashboard Server running at http://localhost:${port}`);
    
    // サーバー起動時にまず最新データを取得（Renderのスリープ復帰対策）
    updateDodgersData();

    // その後、3時間おきに自動更新 (3時間 = 10,800,000ミリ秒)
    setInterval(() => {
        updateDodgersData();
    }, 3 * 60 * 60 * 1000);
});