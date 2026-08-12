import pool from "../db/pool.js";
import { say, fmt } from "../lib/owo.js";

const QUERIES = {
  richest: {
    label: "<:owicoin:1537023515927117874> Richest",
    sql: "SELECT username, coins AS score FROM users ORDER BY coins DESC LIMIT 10",
    unit: "OwiCoins",
  },
  level: {
    label: "⭐ Level",
    sql: "SELECT username, level AS score FROM users ORDER BY level DESC, xp DESC LIMIT 10",
    unit: "Level",
  },
  collection: {
    label: "🎴 Collection Count",
    sql: `SELECT u.username, COALESCE(SUM(i.quantity),0) AS score
          FROM users u LEFT JOIN inventories i ON i.user_id = u.id
          GROUP BY u.id ORDER BY score DESC LIMIT 10`,
    unit: "items",
  },
  value: {
    label: "<:owicoin:1537023515927117874> Collection Value",
    sql: `SELECT u.username, COALESCE(SUM(i.quantity*c.base_value),0) AS score
          FROM users u LEFT JOIN inventories i ON i.user_id = u.id
          LEFT JOIN collectibles c ON c.id = i.collectible_id
          GROUP BY u.id ORDER BY score DESC LIMIT 10`,
    unit: "value",
  },
  fighter: {
    label: "⚔️ Top Fighters",
    sql: "SELECT username, fight_wins AS score FROM users WHERE fight_wins > 0 ORDER BY fight_wins DESC LIMIT 10",
    unit: "wins",
  },
};

export const data = { name: "leaderboard" };

const MEDAL = ["🥇", "🥈", "🥉"];

export async function execute(interaction) {
  const type = (interaction.options.getString("type") ?? "richest").toLowerCase();
  const q = QUERIES[type] ?? QUERIES.richest;
  const [rows] = await pool.query(q.sql);

  const lines = rows.length
    ? rows.map((r, i) => `${MEDAL[i] ?? `\`#${i + 1}\``} **${r.username}** — ${fmt(r.score)} ${q.unit}`).join("\n")
    : "no players yet~";
  await say(interaction, `🏆 **Leaderboard — ${q.label}**\n${lines}`);
}
