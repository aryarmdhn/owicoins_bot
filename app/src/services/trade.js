import { randomBytes } from "node:crypto";
import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { lockedQty } from "../repositories/inventory.js";
import { mutate } from "./economy.js";
import { getSetting } from "./settings.js";

export class TradeError extends Error {}

const EXPIRY_MIN = 10;

async function resolveItem(name, conn) {
  const [[item]] = await conn.query("SELECT id, name, rarity FROM collectibles WHERE name = ?", [name]);
  if (!item) throw new TradeError(`Unknown collectible: "${name}".`);
  return item;
}

async function assertAvailable(userId, item, qty, conn) {
  const [[owned]] = await conn.query(
    "SELECT quantity FROM inventories WHERE user_id = ? AND collectible_id = ?",
    [userId, item.id]
  );
  const locked = await lockedQty(userId, item.id, conn);
  if ((owned ? owned.quantity : 0) - locked < qty) {
    throw new TradeError(`Not enough ${item.name} available (some may be in another trade).`);
  }
}

export async function create(sender, receiver, offer, request) {
  if (sender.id === receiver.id) throw new TradeError("You cannot trade with yourself.");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const s = await getOrCreate(sender.id, sender.username, conn);
    const r = await getOrCreate(receiver.id, receiver.username, conn);

    if (offer.coins < 0 || request.coins < 0) throw new TradeError("Coins cannot be negative.");
    if (offer.coins > 0) {
      const [[su]] = await conn.query("SELECT coins FROM users WHERE id = ?", [s.id]);
      if (su.coins < offer.coins) throw new TradeError("You don't have enough coins to offer.");
    }

    const offerItem = offer.itemName ? await resolveItem(offer.itemName, conn) : null;
    const requestItem = request.itemName ? await resolveItem(request.itemName, conn) : null;
    if (offerItem) await assertAvailable(s.id, offerItem, offer.qty, conn);

    const code = "TRADE-" + randomBytes(3).toString("hex").toUpperCase();
    const [tx] = await conn.query(
      "INSERT INTO trades (trade_code, sender_id, receiver_id, sender_coins, receiver_coins, status, expires_at, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, 'pending', NOW() + INTERVAL ? MINUTE, NOW(), NOW())",
      [code, s.id, r.id, offer.coins, request.coins, EXPIRY_MIN]
    );
    if (offerItem)
      await conn.query("INSERT INTO trade_items (trade_id, user_id, collectible_id, quantity) VALUES (?, ?, ?, ?)", [tx.insertId, s.id, offerItem.id, offer.qty]);
    if (requestItem)
      await conn.query("INSERT INTO trade_items (trade_id, user_id, collectible_id, quantity) VALUES (?, ?, ?, ?)", [tx.insertId, r.id, requestItem.id, request.qty]);

    await conn.commit();
    return { id: tx.insertId, code, senderDbId: s.id, receiverDbId: r.id };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function moveItem(fromId, toId, collectibleId, qty, conn) {
  const [res] = await conn.query(
    "UPDATE inventories SET quantity = quantity - ?, updated_at = NOW() WHERE user_id = ? AND collectible_id = ? AND quantity >= ?",
    [qty, fromId, collectibleId, qty]
  );
  if (res.affectedRows === 0) throw new TradeError("Item no longer available.");
  await conn.query("DELETE FROM inventories WHERE user_id = ? AND collectible_id = ? AND quantity = 0", [fromId, collectibleId]);
  await conn.query(
    "INSERT INTO inventories (user_id, collectible_id, quantity, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW()) " +
      "ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = NOW()",
    [toId, collectibleId, qty]
  );
}

export async function execute(tradeId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[t]] = await conn.query("SELECT * FROM trades WHERE id = ? FOR UPDATE", [tradeId]);
    if (!t) throw new TradeError("Trade not found.");
    if (t.status !== "confirmed") throw new TradeError("Trade is not ready.");
    if (new Date(t.expires_at) < new Date()) {
      await conn.query("UPDATE trades SET status = 'expired', updated_at = NOW() WHERE id = ?", [tradeId]);
      await conn.commit();
      throw new TradeError("Trade expired.");
    }

    const [items] = await conn.query("SELECT * FROM trade_items WHERE trade_id = ?", [tradeId]);
    for (const it of items) {
      const to = it.user_id === t.sender_id ? t.receiver_id : t.sender_id;
      await moveItem(it.user_id, to, it.collectible_id, it.quantity, conn);
    }
    if (t.sender_coins > 0) {
      await mutate(t.sender_id, { type: "trade", amount: -t.sender_coins, reference: `trade-out:${t.id}`, xp: 10 }, conn);
      await mutate(t.receiver_id, { type: "trade", amount: t.sender_coins, reference: `trade-in:${t.id}` }, conn);
    }
    if (t.receiver_coins > 0) {
      await mutate(t.receiver_id, { type: "trade", amount: -t.receiver_coins, reference: `trade-out2:${t.id}`, xp: 10 }, conn);
      await mutate(t.sender_id, { type: "trade", amount: t.receiver_coins, reference: `trade-in2:${t.id}` }, conn);
    }

    await conn.query("UPDATE trades SET status = 'completed', updated_at = NOW() WHERE id = ?", [tradeId]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function setStatus(tradeId, status) {
  await pool.query("UPDATE trades SET status = ?, updated_at = NOW() WHERE id = ?", [status, tradeId]);
}
