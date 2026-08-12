import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import pool from "../db/pool.js";
import { fmt } from "../lib/owo.js";

const PAGE_SIZE = 10;

// {select} is the score column, {from} the table/joins, {order} the sort. count wraps the same source.
const QUERIES = {
  richest: {
    label: "<:owicoin:1537023515927117874> Richest",
    unit: "OwiCoins",
    from: "users",
    select: "username, coins AS score",
    order: "coins DESC",
    countFrom: "users",
  },
  level: {
    label: "⭐ Level",
    unit: "Level",
    from: "users",
    select: "username, level AS score",
    order: "level DESC, xp DESC",
    countFrom: "users",
  },
  collection: {
    label: "🎴 Collection Count",
    unit: "items",
    from: `users u LEFT JOIN inventories i ON i.user_id = u.id`,
    select: "u.username, COALESCE(SUM(i.quantity),0) AS score",
    group: "u.id",
    order: "score DESC",
    countFrom: "users",
  },
  value: {
    label: "<:owicoin:1537023515927117874> Collection Value",
    unit: "value",
    from: `users u LEFT JOIN inventories i ON i.user_id = u.id LEFT JOIN collectibles c ON c.id = i.collectible_id`,
    select: "u.username, COALESCE(SUM(i.quantity*c.base_value),0) AS score",
    group: "u.id",
    order: "score DESC",
    countFrom: "users",
  },
  fighter: {
    label: "⚔️ Top Fighters",
    unit: "wins",
    from: "users",
    select: "username, fight_wins AS score",
    where: "fight_wins > 0",
    order: "fight_wins DESC",
    countFrom: "users WHERE fight_wins > 0",
  },
};

export const data = { name: "leaderboard" };

const MEDAL = ["🥇", "🥈", "🥉"];

export async function render(type, page) {
  const q = QUERIES[type] ?? QUERIES.richest;
  const key = QUERIES[type] ? type : "richest";

  const [[{ total }]] = await pool.query(
    q.group
      ? `SELECT COUNT(*) AS total FROM (SELECT 1 FROM ${q.from} GROUP BY ${q.group}) t`
      : `SELECT COUNT(*) AS total FROM ${q.countFrom}`
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(Math.max(1, page), pages);
  const offset = (cur - 1) * PAGE_SIZE;

  const sql =
    `SELECT ${q.select} FROM ${q.from}` +
    (q.where ? ` WHERE ${q.where}` : "") +
    (q.group ? ` GROUP BY ${q.group}` : "") +
    ` ORDER BY ${q.order} LIMIT ? OFFSET ?`;
  const [rows] = await pool.query(sql, [PAGE_SIZE, offset]);

  const body = rows.length
    ? rows.map((r, i) => {
        const rank = offset + i;
        const badge = rank < 3 ? MEDAL[rank] : `\`#${rank + 1}\``;
        return `${badge} **${r.username}** — ${fmt(r.score)} ${q.unit}`;
      }).join("\n")
    : "no players yet~";

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🏆 Leaderboard — ${q.label}`)
    .setDescription(body)
    .setFooter({ text: `page ${cur}/${pages} · ${fmt(total)} players` });

  const id = (p) => `lb:${key}:${p}`;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(id(cur - 1)).setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(cur <= 1),
    new ButtonBuilder().setCustomId(id(cur + 1)).setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(cur >= pages)
  );
  return { embeds: [embed], components: pages > 1 ? [row] : [] };
}

export async function execute(interaction) {
  const type = (interaction.options.getString("type") ?? "richest").toLowerCase();
  await interaction.reply(await render(type, 1));
}
