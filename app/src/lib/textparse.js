const SCHEMA = {
  profile: [{ name: "user", type: "user" }],
  stats: [{ name: "user", type: "user" }],
  daily: [],
  work: [],
  coins: [],
  help: [],
  achievements: [],
  quest: [],
  pull: [{ name: "pulls", type: "int" }],
  banner: [{ name: "pulls", type: "int" }],
  boss: [],
  inventory: [{ name: "filters", type: "filters" }],
  collection: [{ name: "filters", type: "filters" }],
  item: [{ name: "collectible", type: "rest" }],
  fuse: [{ name: "collectible", type: "rest" }],
  sell: [{ name: "sell", type: "sell" }],
  leaderboard: [{ name: "type", type: "str" }],
  trade: [{ name: "user", type: "user" }],
  fight: [
    { name: "user", type: "user" },
    { name: "bet", type: "int" },
  ],
  send: [
    { name: "user", type: "user" },
    { name: "amount", type: "int" },
  ],
  cf: [
    { name: "bet", type: "str" },
    { name: "side", type: "str" },
  ],
  dice: [{ name: "bet", type: "str" }],
  slots: [{ name: "bet", type: "str" }],
  mine: [{ name: "bet", type: "str" }],
  bj: [{ name: "bet", type: "str" }],
  crash: [{ name: "bet", type: "str" }],
  spin: [],
  pray: [],
  luck: [],
  hug: [{ name: "user", type: "user" }],
  pat: [{ name: "user", type: "user" }],
  slap: [{ name: "user", type: "user" }],
  kiss: [{ name: "user", type: "user" }],
  bonk: [{ name: "user", type: "user" }],
  bite: [{ name: "user", type: "user" }],
  poke: [{ name: "user", type: "user" }],
  cuddle: [{ name: "user", type: "user" }],
  tickle: [{ name: "user", type: "user" }],
  yeet: [{ name: "user", type: "user" }],
  beg: [],
  cepekan: [{ name: "user", type: "user" }],
};

export function commandNames() {
  return Object.keys(SCHEMA);
}

export function tokenize(str) {
  str = str.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'");
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(str))) out.push(m[1] ?? m[2]);
  return out;
}

const MENTION = /^<@!?(\d+)>$/;

export function parseArgs(name, tokens, message) {
  const schema = SCHEMA[name];
  if (!schema) return null;
  const values = {};
  let mentionIdx = 0;
  const mentions = [...message.mentions.users.values()];
  let ti = 0;

  for (const spec of schema) {
    if (spec.type === "user") {
      values[spec.name] = mentions[mentionIdx++] ?? null;
      if (tokens[ti] && MENTION.test(tokens[ti])) ti++;
      continue;
    }
    if (spec.type === "sell") {
      const rest = tokens.slice(ti);
      if (rest[0]?.toLowerCase() === "all") {
        values.collectible = "all";
        values.arg2 = rest[1] ?? null;
      } else {
        const last = rest[rest.length - 1];
        const hasQty = rest.length > 1 && Number.isInteger(Number(last)) && Number(last) > 0;
        values.collectible = (hasQty ? rest.slice(0, -1) : rest).join(" ").trim() || null;
        values.arg2 = hasQty ? last : null;
      }
      ti = tokens.length;
      continue;
    }
    if (spec.type === "filters") {
      // page number + flags: sort:value|rarity|power, rarity:X, category:X, q:text (or bare words → search)
      const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "immortal"];
      const SORTS = ["value", "rarity", "power", "name"];
      const out = { page: 1, rarity: null, category: null, sort: null, q: null };
      const words = [];
      for (const t of tokens.slice(ti)) {
        const m = /^(sort|rarity|category|q):(.+)$/i.exec(t);
        if (m) {
          const k = m[1].toLowerCase();
          out[k] = k === "q" ? m[2] : m[2].toLowerCase();
        } else if (/^\d+$/.test(t)) out.page = Number(t);
        else if (RARITIES.includes(t.toLowerCase())) out.rarity = t.toLowerCase();
        else if (SORTS.includes(t.toLowerCase())) out.sort = t.toLowerCase();
        else words.push(t);
      }
      if (!out.q && words.length) out.q = words.join(" ");
      values.filters = out;
      ti = tokens.length;
      continue;
    }
    if (spec.type === "rest") {
      const rest = tokens.slice(ti).join(" ").trim();
      values[spec.name] = rest || null;
      ti = tokens.length;
      continue;
    }
    const raw = tokens[ti++];
    if (raw === undefined) {
      values[spec.name] = null;
    } else if (spec.type === "int") {
      const n = Number(raw);
      values[spec.name] = Number.isInteger(n) ? n : null;
    } else {
      values[spec.name] = raw;
    }
  }
  return values;
}
