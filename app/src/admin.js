import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import pool from "./db/pool.js";
import { getSetting, setSetting } from "./services/settings.js";
import { mutate } from "./services/economy.js";
import { getOrCreate } from "./repositories/users.js";

const rl = readline.createInterface({ input, output });
const ask = (q) => rl.question(q);
const fmt = (n) => Number(n).toLocaleString("en-US");

const POWER = { Common: 10, Uncommon: 20, Rare: 35, Epic: 55, Legendary: 80, Mythic: 120, Immortal: 150 };
const VALUE = { Common: 100, Uncommon: 250, Rare: 600, Epic: 1500, Legendary: 5000, Mythic: 20000, Immortal: 100000 };

async function findUser(label) {
  const q = await ask(`  ${label} (username or discord_id): `);
  const [rows] = await pool.query("SELECT * FROM users WHERE username = ? OR discord_id = ?", [q, q]);
  if (!rows.length) {
    console.log("  ! user not found\n");
    return null;
  }
  return rows[0];
}

// ---------- menus ----------

async function menuSettings() {
  const keys = [
    "gacha.cost.single", "gacha.cost.multi", "gacha.rarity_weights",
    "daily.base", "daily.max", "work.min", "work.max", "sell.value",
    "cooldown.daily_hours", "cooldown.work_hours", "cooldown.gacha_seconds", "banner.active",
  ];
  while (true) {
    console.log("\n=== SETTINGS ===");
    for (let i = 0; i < keys.length; i++) {
      const v = await getSetting(keys[i], "(unset)");
      console.log(`  ${i + 1}. ${keys[i]} = ${typeof v === "object" ? JSON.stringify(v) : v}`);
    }
    console.log("  0. back");
    const c = await ask("> ");
    if (c === "0") return;
    const key = keys[Number(c) - 1];
    if (!key) { console.log("! invalid"); continue; }
    const val = await ask(`  new value for ${key}: `);
    await setSetting(key, val.trim());
    console.log("  ✓ updated");
  }
}

async function menuCoins() {
  const user = await findUser("target");
  if (!user) return;
  console.log(`  ${user.username} has ${fmt(user.coins)} OwiCoins`);
  const amtStr = await ask("  amount (+ add / - remove): ");
  const amount = Number(amtStr);
  if (!Number.isInteger(amount) || amount === 0) { console.log("! invalid amount"); return; }
  try {
    const r = await mutate(user.id, { type: amount > 0 ? "admin_add" : "admin_remove", amount, reference: `admincli:${user.id}:${Date.now()}` });
    console.log(`  ✓ new balance: ${fmt(r.balance)}`);
  } catch (e) {
    console.log(`  ! ${e.message}`);
  }
}

async function menuLuck() {
  const user = await findUser("target");
  if (!user) return;
  console.log("  1. set boost   2. clear   0. back");
  const c = await ask("> ");
  if (c === "1") {
    const mult = Number(await ask("  multiplier (e.g. 2.0): "));
    const hours = Number(await ask("  duration hours (0 = permanent): "));
    if (!Number.isFinite(mult) || mult <= 0) { console.log("! invalid"); return; }
    const expires = hours > 0 ? new Date(Date.now() + hours * 3.6e6) : null;
    await pool.query(
      "INSERT INTO user_luck (user_id, multiplier, expires_at, updated_at) VALUES (?, ?, ?, NOW()) " +
        "ON DUPLICATE KEY UPDATE multiplier = VALUES(multiplier), expires_at = VALUES(expires_at), updated_at = NOW()",
      [user.id, mult, expires]
    );
    console.log(`  ✓ luck ×${mult}${hours > 0 ? ` for ${hours}h` : " (permanent)"}`);
  } else if (c === "2") {
    await pool.query("DELETE FROM user_luck WHERE user_id = ?", [user.id]);
    console.log("  ✓ cleared");
  }
}

async function menuCollectible() {
  while (true) {
    console.log("\n=== COLLECTIBLES ===");
    console.log("  1. create   2. edit   3. delete   4. list   0. back");
    const c = await ask("> ");
    if (c === "0") return;
    if (c === "1") {
      const name = (await ask("  name: ")).trim();
      const rarity = (await ask("  rarity (Common..Immortal): ")).trim();
      if (!POWER[rarity]) { console.log("! invalid rarity"); continue; }
      const category = (await ask("  category: ")).trim() || "Beast";
      const desc = (await ask("  description: ")).trim();
      const img = (await ask("  image_url (blank = default): ")).trim() || null;
      const limited = (await ask("  limited? season name (blank = no): ")).trim();
      await pool.query(
        "INSERT INTO collectibles (name, description, rarity, category, base_value, power, image_url, is_limited, season, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
        [name, desc, rarity, category, VALUE[rarity], POWER[rarity], img, limited ? 1 : 0, limited || null]
      );
      console.log("  ✓ created");
    } else if (c === "2") {
      const id = Number(await ask("  id: "));
      const field = (await ask("  field (name/description/rarity/category/base_value/power/image_url): ")).trim();
      if (!["name", "description", "rarity", "category", "base_value", "power", "image_url"].includes(field)) { console.log("! invalid field"); continue; }
      const val = (await ask("  new value: ")).trim();
      const [r] = await pool.query(`UPDATE collectibles SET ${field} = ? WHERE id = ?`, [val, id]);
      console.log(r.affectedRows ? "  ✓ updated" : "  ! not found");
    } else if (c === "3") {
      const id = Number(await ask("  id: "));
      const [[used]] = await pool.query("SELECT COUNT(*) n FROM inventories WHERE collectible_id = ?", [id]);
      if (used.n > 0) { console.log("  ! owned by users, cannot delete (edit instead)"); continue; }
      const [r] = await pool.query("DELETE FROM collectibles WHERE id = ?", [id]);
      console.log(r.affectedRows ? "  ✓ deleted" : "  ! not found");
    } else if (c === "4") {
      const [rows] = await pool.query("SELECT id, name, rarity, power, is_limited FROM collectibles ORDER BY id DESC LIMIT 30");
      for (const r of rows) console.log(`  #${r.id} ${r.name} (${r.rarity}) ⚔${r.power}${r.is_limited ? " 🌟limited" : ""}`);
      console.log(`  (showing latest ${rows.length})`);
    }
  }
}

async function menuBoss() {
  const [[active]] = await pool.query("SELECT * FROM bosses WHERE status='active' ORDER BY id DESC LIMIT 1");
  if (active) console.log(`  active: ${active.name} — ${fmt(active.hp)}/${fmt(active.max_hp)} HP, pool ${fmt(active.reward_pool)}`);
  else console.log("  no active boss");
  console.log("  1. spawn boss   2. end current   0. back");
  const c = await ask("> ");
  if (c === "1") {
    const name = (await ask("  name: ")).trim();
    const hp = Number(await ask("  max HP: "));
    const pool_ = Number(await ask("  reward pool: "));
    if (!hp || !pool_) { console.log("! invalid"); return; }
    await pool.query("UPDATE bosses SET status='ended' WHERE status='active'");
    await pool.query("INSERT INTO bosses (name, max_hp, hp, reward_pool, status, created_at) VALUES (?, ?, ?, ?, 'active', NOW())", [name, hp, hp, pool_]);
    await pool.query("UPDATE inventories SET current_hp = NULL");
    console.log("  ✓ spawned (all pet HP restored)");
  } else if (c === "2") {
    await pool.query("UPDATE bosses SET status='ended' WHERE status='active'");
    console.log("  ✓ ended");
  }
}

async function menuBanner() {
  const cur = await getSetting("banner.active", "");
  console.log(`  current banner: ${cur || "(none)"}`);
  const val = (await ask("  new season name (blank = disable): ")).trim();
  await setSetting("banner.active", val);
  console.log(val ? `  ✓ banner set to ${val}` : "  ✓ banner disabled");
}

async function menuResetQuota() {
  const user = await findUser("target");
  if (!user) return;
  console.log("  1. reset PRAY quota (today)   2. reset SEND quota (today)   3. reset BOTH   0. back");
  const c = await ask("> ");
  if (c === "0") return;
  if (c === "1" || c === "3") {
    await pool.query("UPDATE users SET pray_count = 0 WHERE id = ?", [user.id]);
    console.log("  ✓ pray quota reset");
  }
  if (c === "2" || c === "3") {
    const [r] = await pool.query(
      "UPDATE economy_transactions SET type = 'send_reset' WHERE user_id = ? AND type = 'send' AND amount < 0 AND DATE(created_at) = CURDATE()",
      [user.id]
    );
    console.log(`  ✓ send quota reset (${r.affectedRows} tx cleared)`);
  }
}

async function main() {
  while (true) {
    console.log("\n========== OWICOINS ADMIN ==========");
    console.log("  1. Settings (config)");
    console.log("  2. User OwiCoins (add/remove)");
    console.log("  3. User Luck boost");
    console.log("  4. Collectibles (CRUD)");
    console.log("  5. Limited Banner");
    console.log("  6. World Boss");
    console.log("  7. Reset Send/Pray Quota");
    console.log("  0. Exit");
    const c = await ask("> ");
    if (c === "0") break;
    else if (c === "1") await menuSettings();
    else if (c === "2") await menuCoins();
    else if (c === "3") await menuLuck();
    else if (c === "4") await menuCollectible();
    else if (c === "5") await menuBanner();
    else if (c === "6") await menuBoss();
    else if (c === "7") await menuResetQuota();
    else console.log("! invalid choice");
  }
  rl.close();
  await pool.end();
  console.log("bye 👋");
}

main();
