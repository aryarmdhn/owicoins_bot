import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { lockedQty } from "../repositories/inventory.js";
import { mutate } from "./economy.js";

export class TradeError extends Error {}

export const sessions = new Map(); // id -> session
let seq = 0;

export function create(a, b) {
  const id = ++seq;
  const s = {
    id,
    a: { user: a, items: new Map(), coins: 0, confirmed: false },
    b: { user: b, items: new Map(), coins: 0, confirmed: false },
    status: "open",
  };
  sessions.set(id, s);
  setTimeout(() => {
    const cur = sessions.get(id);
    if (cur && cur.status === "open") {
      cur.status = "expired";
      sessions.delete(id);
      cur.message?.edit?.({ content: "⌛ trade expired.", components: [] }).catch(() => {});
    }
  }, 5 * 60000);
  return s;
}

export function sideFor(s, userId) {
  if (s.a.user.id === userId) return s.a;
  if (s.b.user.id === userId) return s.b;
  return null;
}

// any change resets confirmations (so nobody confirms a changed deal)
function touch(s) {
  s.a.confirmed = false;
  s.b.confirmed = false;
}

export async function availableQty(userDbId, collectibleId) {
  const [[owned]] = await pool.query("SELECT quantity FROM inventories WHERE user_id = ? AND collectible_id = ?", [userDbId, collectibleId]);
  const locked = await lockedQty(userDbId, collectibleId, pool);
  return (owned ? owned.quantity : 0) - locked;
}

export function addItem(s, userId, item) {
  const side = sideFor(s, userId);
  side.items.set(item.id, { id: item.id, name: item.name, rarity: item.rarity, qty: (side.items.get(item.id)?.qty ?? 0) + 1 });
  touch(s);
}

export function setItemQty(s, userId, collectibleId, qty) {
  const side = sideFor(s, userId);
  if (qty <= 0) side.items.delete(collectibleId);
  else if (side.items.has(collectibleId)) side.items.get(collectibleId).qty = qty;
  touch(s);
}

export function setCoins(s, userId, coins) {
  sideFor(s, userId).coins = Math.max(0, Math.floor(coins));
  touch(s);
}

export function confirm(s, userId) {
  sideFor(s, userId).confirmed = true;
  return s.a.confirmed && s.b.confirmed;
}

async function moveItem(fromId, toId, collectibleId, qty, conn) {
  const [res] = await conn.query(
    "UPDATE inventories SET quantity = quantity - ?, updated_at = NOW() WHERE user_id = ? AND collectible_id = ? AND quantity >= ?",
    [qty, fromId, collectibleId, qty]
  );
  if (res.affectedRows === 0) throw new TradeError("An item is no longer available.");
  await conn.query("DELETE FROM inventories WHERE user_id = ? AND collectible_id = ? AND quantity = 0", [fromId, collectibleId]);
  await conn.query(
    "INSERT INTO inventories (user_id, collectible_id, quantity, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW()) " +
      "ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = NOW()",
    [toId, collectibleId, qty]
  );
}

export async function execute(s) {
  const conn = await pool.getConnection();
  const nonce = Date.now();
  try {
    await conn.beginTransaction();
    if (!s.a.items.size && !s.b.items.size && !s.a.coins && !s.b.coins) throw new TradeError("Nothing to trade — add an item or coins first.");
    const au = await getOrCreate(s.a.user.id, s.a.user.username, conn);
    const bu = await getOrCreate(s.b.user.id, s.b.user.username, conn);

    // move items A -> B
    for (const it of s.a.items.values()) await moveItem(au.id, bu.id, it.id, it.qty, conn);
    // move items B -> A
    for (const it of s.b.items.values()) await moveItem(bu.id, au.id, it.id, it.qty, conn);

    // coins (mutate checks funds; gift-only is fine since side.coins can be 0)
    if (s.a.coins > 0) {
      await mutate(au.id, { type: "trade", amount: -s.a.coins, reference: `tsess:${s.id}:a-out:${nonce}` }, conn);
      await mutate(bu.id, { type: "trade", amount: s.a.coins, reference: `tsess:${s.id}:a-in:${nonce}` }, conn);
    }
    if (s.b.coins > 0) {
      await mutate(bu.id, { type: "trade", amount: -s.b.coins, reference: `tsess:${s.id}:b-out:${nonce}` }, conn);
      await mutate(au.id, { type: "trade", amount: s.b.coins, reference: `tsess:${s.id}:b-in:${nonce}` }, conn);
    }

    await conn.commit();
    s.status = "done";
    sessions.delete(s.id);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
