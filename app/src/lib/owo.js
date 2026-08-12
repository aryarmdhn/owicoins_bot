export const fmt = (n) => Number(n).toLocaleString("en-US");

export const RARITY_EMOJI = {
  Common: "<:gacha_1_common:1537027079730630716>",
  Uncommon: "<:gacha_2_uncommon:1537027081739698196>",
  Rare: "<:gacha_3_rare:1537027084872974366>",
  Epic: "<:gacha_4_epic:1537027086999625810>",
  Legendary: "<:gacha_5_legendary:1537027090120052736>",
  Mythic: "<:gacha_6_mythic:1537027092871647232>",
  Immortal: "<:gacha_7_immortal:1537027095325048832>",
};

export const RARITY_COLOR = {
  Common: 0xb0b0b0, Uncommon: 0x57f287, Rare: 0x3b82f6, Epic: 0xa855f7,
  Legendary: 0xf59e0b, Mythic: 0xef4444, Immortal: 0xffd700,
};

// per-pet emoji (id_Name:emojiId). key = collectible name. overrides the rarity icon.
export const PET_EMOJI = {
  "God Owi": "<:001_God_Owi:1537130325480579083>",
  "Elder Dragon": "<:147_Elder_Dragon:1537129378842939412>",
  "World Serpent": "<:148_World_Serpent:1537129381418500188>",
  "Cosmic Behemoth": "<:149_Cosmic_Behemoth:1537129383196631060>",
  "Volcano Titan": "<:150_Volcano_Titan:1537129385046315080>",
  "Mind Master": "<:175_Mind_Master:1537129386967568485>",
  "Mad Titan": "<:176_Mad_Titan:1537129389253468220>",
  "Infinity Wielder": "<:177_Infinity_Wielder:1537129391258341417>",
  "Golden Dragon": "<:137_Golden_Dragon:1537130735549288539>",
  "Storm Wyrm": "<:138_Storm_Wyrm:1537130738305081484>",
  "Bone Tyrant": "<:139_Bone_Tyrant:1537130740918132766>",
  "Kraken": "<:140_Kraken:1537130743606673488>",
  "Leviathan": "<:141_Leviathan:1537130745963872456>",
  "Nemean Lion": "<:142_Nemean_Lion:1537130748472197211>",
  "Celestial Steed": "<:143_Celestial_Steed:1537130751043182602>",
  "Phoenix": "<:144_Phoenix:1537130752888803429>",
  "Fenrir": "<:145_Fenrir:1537130754977562758>",
  "Jörmungandr": "<:146_J_rmungandr:1537130757422841896>",
  "Storm Bringer": "<:169_Storm_Bringer:1537130759587102792>",
  "Cosmic Captain": "<:170_Cosmic_Captain:1537130761755562054>",
  "Iron Overlord": "<:171_Iron_Overlord:1537130764246978692>",
  "Thunder God": "<:172_Thunder_God:1537130766318837831>",
  "Rage Titan": "<:173_Rage_Titan:1537130768483225761>",
  "Sorcerer Supreme": "<:174_Sorcerer_Supreme:1537130770630574181>",
};

// icon for a collectible: its own pet emoji if defined, else the rarity emoji.
export const iconFor = (name, rarity) => PET_EMOJI[name] ?? RARITY_EMOJI[rarity] ?? "";

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export async function say(interaction, content, reactions = []) {
  const msg = await interaction.reply({ content });
  for (const emoji of reactions) {
    await msg?.react?.(emoji).catch(() => {});
  }
  return msg;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function animate(msg, frames, delayMs = 450) {
  for (const content of frames) {
    await msg?.edit?.({ content, allowedMentions: { parse: [] } }).catch(() => {});
    await sleep(delayMs);
  }
}

export async function sayTemp(interaction, content, deleteAfterMs) {
  const msg = await interaction.reply({ content });
  const ms = Math.min(Math.max(deleteAfterMs, 1000), 3600000);
  setTimeout(() => msg?.delete?.().catch(() => {}), ms);
  return msg;
}
