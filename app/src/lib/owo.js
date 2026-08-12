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
