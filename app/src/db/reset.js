import pool from "./pool.js";

const TABLES = [
  "gacha_results",
  "gacha_transactions",
  "trade_items",
  "trades",
  "economy_transactions",
  "inventories",
  "user_luck",
  "collectibles",
  "users",
];

await pool.query("SET FOREIGN_KEY_CHECKS = 0");
for (const t of TABLES) {
  await pool.query(`TRUNCATE TABLE \`${t}\``);
  console.log(`truncated ${t}`);
}
await pool.query("SET FOREIGN_KEY_CHECKS = 1");

console.log("reset done — run `npm run seed` next");
await pool.end();
