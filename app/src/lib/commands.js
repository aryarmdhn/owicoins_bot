import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../commands");

export async function loadCommands() {
  const commands = new Map();
  const files = (await readdir(dir)).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    const mod = await import(pathToFileURL(join(dir, file)).href);
    if (!mod.data || !mod.execute) {
      console.warn(`skip ${file}: missing data/execute`);
      continue;
    }
    commands.set(mod.data.name, mod);
  }
  return commands;
}
