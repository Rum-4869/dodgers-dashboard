const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE || 'test',
        port: 4000,
        ssl: { rejectUnauthorized: true }
    });
    
    const [rows] = await connection.execute("SELECT game_datetime FROM dodgers_games ORDER BY game_date ASC");
    let target = null;
    const now = new Date();
    console.log("Current time:", now);
    for (const g of rows) {
        if (!g.game_datetime) continue;
        const gameTime = new Date(g.game_datetime);
        if (gameTime > now) {
            target = g;
            console.log("Found:", target.game_datetime);
            console.log("GameTime Date obj:", gameTime);
            console.log("Days:", Math.floor((gameTime - now) / 86400000));
            break;
        }
    }
    
    await connection.end();
}
check();
