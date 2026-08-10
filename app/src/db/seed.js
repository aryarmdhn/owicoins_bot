import pool from "./pool.js";
import { COLLECTIBLES } from "./collectibles-data.js";

const settings = {
  "gacha.cost.single": "1000",
  "gacha.cost.multi": "9000",
  "gacha.rarity_weights": JSON.stringify({
    Common: 55, Uncommon: 25, Rare: 12, Epic: 6, Legendary: 1.8, Mythic: 0.2, Immortal: 0.01,
  }),
  "daily.base": "1000",
  "daily.max": "5000",
  "work.min": "300",
  "work.max": "1000",
  "sell.value": JSON.stringify({
    Common: 100, Uncommon: 250, Rare: 600, Epic: 1500, Legendary: 5000, Mythic: 20000, Immortal: 100000,
  }),
  "cooldown.daily_hours": "24",
  "cooldown.work_hours": "1",
  "cooldown.gacha_seconds": "0",
};

for (const [key, value] of Object.entries(settings)) {
  await pool.query(
    "INSERT INTO settings (`key`, value, updated_at) VALUES (?, ?, NOW()) " +
      "ON DUPLICATE KEY UPDATE `key` = `key`",
    [key, value]
  );
}

for (const key of ["gacha.rarity_weights", "sell.value"]) {
  const [[row]] = await pool.query("SELECT value FROM settings WHERE `key` = ?", [key]);
  if (row && !JSON.parse(row.value).Immortal) {
    const merged = { ...JSON.parse(row.value), Immortal: key === "sell.value" ? 100000 : 0.01 };
    await pool.query("UPDATE settings SET value = ?, updated_at = NOW() WHERE `key` = ?", [JSON.stringify(merged), key]);
  }
}

let inserted = 0;
for (const c of COLLECTIBLES) {
  const [rows] = await pool.query("SELECT id FROM collectibles WHERE name = ?", [c.name]);
  if (rows.length) {
    await pool.query("UPDATE collectibles SET image_url = ?, power = ? WHERE name = ? AND (image_url IS NULL OR image_url = '')", [c.image_url, c.power, c.name]);
    continue;
  }
  await pool.query(
    "INSERT INTO collectibles (name, description, rarity, category, base_value, power, image_url, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
    [c.name, c.description, c.rarity, c.category, c.base_value, c.power, c.image_url]
  );
  inserted++;
}

const RARITY_ICON = {
  Common: "26aa", Uncommon: "1f7e2", Rare: "1f535", Epic: "1f7e3", Legendary: "1f7e1", Mythic: "1f534",
};
for (const [rarity, hex] of Object.entries(RARITY_ICON)) {
  await pool.query(
    "UPDATE collectibles SET image_url = ? WHERE rarity = ? AND (image_url IS NULL OR image_url = '')",
    [`https://cdn.jsdelivr.net/gh/twitter/twemoji/assets/72x72/${hex}.png`, rarity]
  );
}

console.log(`seed done (${inserted} new collectibles)`);
await pool.end();
