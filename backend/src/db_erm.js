const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host:              process.env.ERM_DB_HOST,
  user:              process.env.ERM_DB_USER,
  password:          process.env.ERM_DB_PASSWORD,
  database:          process.env.ERM_DB_NAME,
  waitForConnections: true,
  connectionLimit:   10,
});

module.exports = pool.promise();