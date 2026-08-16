import { cepekan, OnCooldown, CepekanError } from "../services/beg.js";
import { say, sayTemp, fmt } from "../lib/owo.js";

export const data = { name: "cepekan" };

export async function execute(interaction) {
  const u = interaction.user;
  const target = interaction.options.getUser("user");
  if (!target) {
    await say(interaction, `🥺 <@${u.id}> tag orangnya! contoh: \`gcepekan @user\` → minta cepekan ke @user`);
    return;
  }
  try {
    const r = await cepekan(u, target);
    if (r.gave) {
      await say(interaction, `🤲 <@${u.id}> minta cepekan ke <@${target.id}>…\n<@${target.id}> baik hati, ngasih **${fmt(r.coins)}** OwiCoins! 🙏`);
    } else if (r.broke) {
      await say(interaction, `🤲 <@${u.id}> minta cepekan ke <@${target.id}>…\n<@${target.id}> lagi bokek juga, gak bisa ngasih 😭`);
    } else {
      await say(interaction, `🤲 <@${u.id}> minta cepekan ke <@${target.id}>…\n<@${target.id}> pura-pura gak liat 🏃💨 gagal!`);
    }
  } catch (e) {
    if (e instanceof OnCooldown) {
      await sayTemp(interaction, `⏳ <@${u.id}> jangan ngemis mulu, sabar! coba lagi <t:${Math.floor(e.nextAt.getTime() / 1000)}:R>`, e.nextAt.getTime() - Date.now());
      return;
    }
    if (e instanceof CepekanError) {
      await say(interaction, `❌ <@${u.id}> ${e.message}`);
      return;
    }
    throw e;
  }
}
