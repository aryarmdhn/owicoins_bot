import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate, InsufficientFunds } from "./economy.js";

export class OnCooldown extends Error {
  constructor(nextAt) {
    super("on cooldown");
    this.nextAt = nextAt;
  }
}
export class CepekanError extends Error {}

const BEG_COOLDOWN_MIN = 30;
const CEPEKAN_COOLDOWN_MIN = 30;

const OUTCOMES = [
  { weight: 30, min: 0, max: 0, text: "Kamu diusir satpam mall 🏃💨 gak dapet apa-apa!" },
  { weight: 25, min: 5, max: 20, text: "Ada orang baik hati ngasih receh 🙏" },
  { weight: 20, min: 20, max: 40, text: "Kamu ngamen di lampu merah, lumayan… 🎸" },
  { weight: 15, min: 40, max: 60, text: "Om-om dermawan lewat, langsung ditransfer! 🤝" },
  { weight: 8, min: 0, max: 0, text: "Dompetmu malah dicopet 😭 zonk total!" },
  { weight: 2, min: 80, max: 150, text: "🎉 SULTAN LEWAT! dikasih segepok receh!" },
];

function draw(rand = Math.random) {
  const total = OUTCOMES.reduce((s, o) => s + o.weight, 0);
  let r = rand() * total;
  for (const o of OUTCOMES) if ((r -= o.weight) < 0) return o;
  return OUTCOMES[0];
}

const rollCoins = (o) => o.min + Math.floor(Math.random() * (o.max - o.min + 1));

async function checkCooldown(conn, userId, column, mins) {
  const [[row]] = await conn.query(
    `SELECT TIMESTAMPDIFF(SECOND, ${column}, NOW()) AS elapsed, ${column} + INTERVAL ? MINUTE AS next_at FROM users WHERE id = ? FOR UPDATE`,
    [mins, userId]
  );
  if (row.elapsed !== null && row.elapsed < mins * 60) throw new OnCooldown(new Date(row.next_at));
}

export async function beg(discordId, username) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreate(discordId, username, conn);
    await checkCooldown(conn, user.id, "last_beg_at", BEG_COOLDOWN_MIN);
    await conn.query("UPDATE users SET last_beg_at = NOW() WHERE id = ?", [user.id]);

    const o = draw();
    const coins = rollCoins(o);
    if (coins > 0) {
      await mutate(user.id, { type: "beg", amount: coins, reference: `beg:${user.id}:${Date.now()}` }, conn);
    }
    await conn.commit();
    return { text: o.text, coins };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function cepekan(fromUser, target) {
  if (target.bot) throw new CepekanError("gak bisa ngemis ke bot, minta ke orang beneran! 🤖");
  if (target.id === fromUser.id) throw new CepekanError("gak bisa ngemis ke diri sendiri wkwk 🤡");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const beggar = await getOrCreate(fromUser.id, fromUser.username, conn);
    const giver = await getOrCreate(target.id, target.username, conn);
    await checkCooldown(conn, beggar.id, "last_cepekan_at", CEPEKAN_COOLDOWN_MIN);
    await conn.query("UPDATE users SET last_cepekan_at = NOW() WHERE id = ?", [beggar.id]);

    const gave = Math.random() < 0.6;
    if (!gave) {
      await conn.commit();
      return { gave: false, coins: 0 };
    }
    const [[g]] = await conn.query("SELECT coins FROM users WHERE id = ? FOR UPDATE", [giver.id]);
    const coins = Math.min(5 + Math.floor(Math.random() * 46), Number(g.coins));
    if (coins <= 0) {
      await conn.commit();
      return { gave: false, coins: 0, broke: true };
    }
    const ref = `cepekan:${beggar.id}:${giver.id}:${Date.now()}`;
    await mutate(giver.id, { type: "cepekan_give", amount: -coins, reference: `${ref}:out` }, conn);
    await mutate(beggar.id, { type: "cepekan_get", amount: coins, reference: `${ref}:in` }, conn);
    await conn.commit();
    return { gave: true, coins };
  } catch (e) {
    await conn.rollback();
    if (e instanceof InsufficientFunds) return { gave: false, coins: 0, broke: true };
    throw e;
  } finally {
    conn.release();
  }
}
