const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'shraviya',
  database: process.env.DB_NAME || 'sfashionsdb',
});

db.connect((err) => {
  if (err) {
    console.error('MySQL connection failed:', err.message);
    process.exit(1);
  }

  console.log(`Connected to MySQL database: ${db.config.database}`);
});

module.exports = db;
