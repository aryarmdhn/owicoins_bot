import mysql from "mysql2/promise";
import config from "../lib/config.js";

const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  timezone: "+07:00",
});

pool.on("connection", (conn) => {
  conn.query("SET time_zone = '+07:00'");
});

export default pool;
