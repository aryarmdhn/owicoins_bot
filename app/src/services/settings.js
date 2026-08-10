import pool from "../db/pool.js";

const cache = new Map();
const TTL_MS = 30_000;

export async function getSetting(key, fallback = null) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const [rows] = await pool.query("SELECT value FROM settings WHERE `key` = ?", [key]);
  const raw = rows.length ? rows[0].value : null;
  const value = raw === null ? fallback : parse(raw, fallback);
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

export async function setSetting(key, value, updatedBy = null) {
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  await pool.query(
    "INSERT INTO settings (`key`, value, updated_at, updated_by) VALUES (?, ?, NOW(), ?) " +
      "ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW(), updated_by = VALUES(updated_by)",
    [key, raw, updatedBy]
  );
  cache.delete(key);
}

function parse(raw, fallback) {
  if (typeof fallback === "object" && fallback !== null) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  if (typeof fallback === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  return raw;
}
