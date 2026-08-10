import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pool from "./pool.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");

await pool.query(
  "CREATE TABLE IF NOT EXISTS migrations (name VARCHAR(255) PRIMARY KEY, applied_at DATETIME NOT NULL)"
);

const [done] = await pool.query("SELECT name FROM migrations");
const applied = new Set(done.map((r) => r.name));
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

for (const file of files) {
  if (applied.has(file)) continue;
  const sql = await readFile(join(dir, file), "utf8");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
      await conn.query(stmt);
    }
    await conn.query("INSERT INTO migrations (name, applied_at) VALUES (?, NOW())", [file]);
    await conn.commit();
    console.log(`migrated: ${file}`);
  } catch (e) {
    await conn.rollback();
    console.error(`failed: ${file}`, e.message);
    process.exit(1);
  } finally {
    conn.release();
  }
}

console.log("migrations up to date");
await pool.end();
