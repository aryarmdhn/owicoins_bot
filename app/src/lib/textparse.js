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
  inventory: [
    { name: "page", type: "int" },
    { name: "rarity", type: "str" },
    { name: "category", type: "str" },
  ],
  collection: [
    { name: "page", type: "int" },
    { name: "rarity", type: "str" },
    { name: "category", type: "str" },
  ],
  item: [{ name: "collectible", type: "str" }],
  fuse: [{ name: "collectible", type: "str" }],
  sell: [
    { name: "collectible", type: "str" },
    { name: "arg2", type: "str" },
  ],
  leaderboard: [{ name: "type", type: "str" }],
  trade: [
    { name: "user", type: "user" },
    { name: "offer_item", type: "str" },
    { name: "offer_qty", type: "int" },
    { name: "offer_coins", type: "int" },
    { name: "request_item", type: "str" },
    { name: "request_qty", type: "int" },
    { name: "request_coins", type: "int" },
  ],
  fight: [
    { name: "user", type: "user" },
    { name: "bet", type: "int" },
  ],
  send: [
    { name: "user", type: "user" },
    { name: "amount", type: "int" },
  ],
  cf: [
    { name: "bet", type: "int" },
    { name: "side", type: "str" },
  ],
  dice: [{ name: "bet", type: "int" }],
  slots: [{ name: "bet", type: "int" }],
  spin: [],
};

export function commandNames() {
  return Object.keys(SCHEMA);
}

export function tokenize(str) {
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
