import pool from "../db/pool.js";

export const ACTIONS = {
  hug: { emoji: "🤗", verb: "hugs", counted: true },
  pat: { emoji: "🫳", verb: "pats", counted: true },
  slap: { emoji: "👋", verb: "slaps", counted: true },
  kiss: { emoji: "😘", verb: "kisses", counted: true },
  bonk: { emoji: "🔨", verb: "bonks", counted: true },
  bite: { emoji: "😬", verb: "bites", counted: true },
  poke: { emoji: "👉", verb: "pokes", counted: false },
  cuddle: { emoji: "🥰", verb: "cuddles", counted: false },
  tickle: { emoji: "🪶", verb: "tickles", counted: false },
  yeet: { emoji: "🚀", verb: "yeets", counted: false },
};

async function gif(action) {
  try {
    const r = await fetch(`https://nekos.best/api/v2/${action}`);
    if (r.ok) return (await r.json())?.results?.[0]?.url ?? null;
  } catch {}
  try {
    const r = await fetch(`https://api.waifu.pics/sfw/${action}`);
    if (r.ok) return (await r.json())?.url ?? null;
  } catch {}
  return null;
}

async function bump(action, targetId) {
  await pool.query(
    "INSERT INTO reaction_counts (action, target_id, count) VALUES (:a, :t, 1) ON DUPLICATE KEY UPDATE count = count + 1",
    { a: action, t: targetId }
  );
  const [rows] = await pool.query("SELECT count FROM reaction_counts WHERE action = :a AND target_id = :t", { a: action, t: targetId });
  return rows[0]?.count ?? 1;
}

export async function react(action, target) {
  const meta = ACTIONS[action];
  const url = await gif(action);
  const count = meta.counted && target ? await bump(action, target.id) : null;
  return { url, count };
}
