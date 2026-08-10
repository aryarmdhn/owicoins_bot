import { attack, activeBoss, BossError, OnCooldown } from "../services/boss.js";
import { say, sayTemp, fmt } from "../lib/owo.js";

export const data = { name: "boss" };

function hpBar(hp, max) {
  const ratio = max > 0 ? Math.max(0, hp / max) : 0;
  const filled = Math.round(ratio * 15);
  return "🟩".repeat(filled) + "⬛".repeat(15 - filled) + ` ${Math.round(ratio * 100)}%`;
}

export async function execute(interaction) {
  const u = interaction.user;
  try {
    const r = await attack(u.id, u.username);
    const petLine = r.petDied
      ? `\n💀 your **${r.weapon}** ran out of HP and **fell in battle**…`
      : r.miss
      ? `\n😵 your **${r.weapon}** missed! pet HP: ❤️ ${r.petHpLeft}/${r.petMaxHp}`
      : "";
    const rip = petLine;

    if (r.defeated) {
      const MEDAL = ["🥇", "🥈", "🥉"];
      const board = r.rewards
        .map((x, i) => {
          const rank = MEDAL[i] ?? `\`#${i + 1}\``;
          const pct = r.totalDmg > 0 ? Math.round((x.damage / r.totalDmg) * 100) : 0;
          return `${rank} <@${x.discordId}> — ⚔️ ${fmt(x.damage)} dmg (${pct}%) → 💰 **${fmt(x.share)} OwiCoins**`;
        })
        .join("\n");
      await say(
        interaction,
        `💥 <@${u.id}> struck the final blow on **${r.boss.name}** with **${r.weapon}** for **${fmt(r.dmg)}** damage!\n` +
          `☠️ **${r.boss.name} DEFEATED!**${rip}\n` +
          `🏆 **Reward pool: ${fmt(r.boss.rewardPool)} OwiCoins** split by damage:\n${board}`,
        ["🎉", "⚔️"]
      );
      return;
    }

    const hitLine = r.miss
      ? `😵 <@${u.id}>'s **${r.weapon}** **MISSED** the **${r.boss.name}**!`
      : `⚔️ <@${u.id}> hit **${r.boss.name}** with **${r.weapon}** for **${fmt(r.dmg)}** damage!`;
    await say(
      interaction,
      `${hitLine}${rip}\n❤️ ${hpBar(r.hpLeft, r.maxHp)}\n_${fmt(r.hpLeft)} / ${fmt(r.maxHp)} boss HP left_`,
      r.petDied ? ["💀"] : r.miss ? ["😵"] : ["⚔️"]
    );
  } catch (e) {
    if (e instanceof OnCooldown) {
      await sayTemp(interaction, `⏳ <@${u.id}> your weapon is recharging — attack again <t:${Math.floor(e.nextAt.getTime() / 1000)}:R>`, e.nextAt.getTime() - Date.now());
      return;
    }
    if (e instanceof BossError) {
      await say(interaction, `❌ <@${u.id}> ${e.message}`);
      return;
    }
    throw e;
  }
}
