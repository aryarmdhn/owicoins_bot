import { fuse, FusionError, FUSE_COST } from "../services/fusion.js";
import { say, RARITY_EMOJI as EMOJI } from "../lib/owo.js";

export const data = { name: "fuse" };

export async function execute(interaction) {
  const u = interaction.user;
  const name = interaction.options.getString("collectible");
  if (!name) {
    await say(interaction, `❌ <@${u.id}> usage: \`gfuse "<item>"\` — fuse ${FUSE_COST}× duplicates into a higher tier`);
    return;
  }
  try {
    const r = await fuse(u.id, u.username, name);
    const react = ["Legendary", "Mythic", "Immortal"].includes(r.targetRarity) ? ["🎉", "✨"] : ["🔮"];
    await say(
      interaction,
      `🔮 <@${u.id}> fused **${r.cost}× ${r.consumed.name}** into ${EMOJI[r.reward.rarity] ?? ""} **${r.reward.name}** (${r.reward.rarity})!`,
      react
    );
  } catch (e) {
    if (e instanceof FusionError) {
      await say(interaction, `❌ <@${u.id}> ${e.message}`);
      return;
    }
    throw e;
  }
}
