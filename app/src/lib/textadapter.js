export function makeInteraction(message, args) {
  let sent = null;
  const options = {
    getString: (n) => (typeof args[n] === "string" ? args[n] : null),
    getInteger: (n) => (typeof args[n] === "number" ? args[n] : null),
    getNumber: (n) => (typeof args[n] === "number" ? args[n] : null),
    getUser: (n) => args[n] ?? null,
    getSubcommand: () => null,
    getSubcommandGroup: () => null,
  };
  return {
    user: message.author,
    member: message.member,
    channel: message.channel,
    client: message.client,
    options,
    isRepliable: () => true,
    isChatInputCommand: () => true,
    isButton: () => false,
    get replied() {
      return sent !== null;
    },
    get deferred() {
      return sent !== null;
    },
    async reply(payload) {
      sent = await message.channel.send(normalize(payload, message));
      return sent;
    },
    async deferReply() {
      sent = await message.channel.send(normalize({ content: "…" }, message));
      return sent;
    },
    async editReply(payload) {
      if (!sent) return this.reply(payload);
      return sent.edit(normalize(payload, message));
    },
    async followUp(payload) {
      return message.channel.send(normalize(payload, message));
    },
  };
}

function normalize(p) {
  const { ephemeral, ...rest } = typeof p === "string" ? { content: p } : p;
  rest.allowedMentions = { parse: [] };
  return rest;
}
