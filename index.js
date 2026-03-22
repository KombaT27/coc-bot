const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events
} = require('discord.js');

const axios = require("axios");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ===== TOKENS =====

const TOKEN = process.env.TOKEN;
const COC_API_TOKEN = process.env.COC_API_TOKEN;

const CLAN_TAG = "%232G2VRYRCG";

// ===== MEMORY =====
const targets = new Map();

// ===== HELPERS =====
function isStaff(member) {
    return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

async function getWar() {
    const res = await axios.get(
        `https://api.clashofclans.com/v1/clans/${CLAN_TAG}/currentwar`,
        { headers: { Authorization: `Bearer ${COC_API_TOKEN}` } }
    );
    return res.data;
}

// ===== READY =====
client.once(Events.ClientReady, () => {
    console.log(`Bot online: ${client.user.tag}`);
});

// ===== COMMAND PANEL =====
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    if (message.content === "!updatecmd") {

        if (!isStaff(message.member)) return;

        const ch = message.guild.channels.cache.find(c => c.name === "bot-commands");
        if (!ch) return message.reply("Channel fehlt");

        // ALTES PANEL LÖSCHEN
        const msgs = await ch.messages.fetch({ limit: 50 });
        const old = msgs.find(m => m.author.id === client.user.id && m.components.length);
        if (old) await old.delete().catch(() => {});

        const embed = new EmbedBuilder()
            .setTitle("🛠️ COMMAND PANEL")
            .setColor(0x5865F2)
            .setDescription(`
⚔️ **WAR SYSTEM**
→ Button: zeigt aktuellen Krieg

❌ **MISSING**
→ Wer noch nicht angegriffen hat

📢 **WARN**
→ Pingt alle die noch nicht angegriffen haben

🏆 **MVP**
→ Bester Spieler im Krieg

🎯 **TARGET SYSTEM**
→ !target @user 5  
→ setzt Ziel (Base 5)

→ Button zeigt alle Targets

🧹 **CLEAR**
→ löscht alles außer Panel
            `);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("war").setLabel("⚔️ War").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("missing").setLabel("❌ Missing").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("warn").setLabel("📢 Warn").setStyle(ButtonStyle.Success)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("mvp").setLabel("🏆 MVP").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("targets").setLabel("🎯 Targets").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("clear").setLabel("🧹 Clear").setStyle(ButtonStyle.Danger)
        );

        await ch.send({ embeds: [embed], components: [row1, row2] });

        message.reply("Panel erstellt");
    }

    // ===== TARGET COMMAND =====
    if (message.content.startsWith("!target")) {
        if (!isStaff(message.member)) return;

        const m = message.mentions.members.first();
        const base = message.content.split(" ")[2];

        if (!m || !base)
            return message.reply("Usage: !target @user 5");

        targets.set(m.id, base);

        message.reply(`🎯 ${m.user.tag} → Base #${base}`);
    }
});

// ===== BUTTONS =====
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    const id = interaction.customId;

    // ===== WAR =====
    if (id === "war") {
        const war = await getWar();

        const embed = new EmbedBuilder()
            .setTitle(`⚔️ ${war.clan.name} vs ${war.opponent.name}`)
            .setDescription(`⭐ ${war.clan.stars} vs ${war.opponent.stars}\n💥 ${war.clan.destructionPercentage}% vs ${war.opponent.destructionPercentage}%`);

        return interaction.reply({ embeds: [embed] });
    }

    // ===== MISSING =====
    if (id === "missing") {
        const war = await getWar();

        const missing = war.clan.members.filter(m => (m.attacks?.length || 0) < war.attacksPerMember);

        if (!missing.length)
            return interaction.reply("✅ Alle haben angegriffen");

        return interaction.reply(missing.map(m => `❌ ${m.name}`).join("\n"));
    }

    // ===== WARN =====
    if (id === "warn") {
        const war = await getWar();

        const missing = war.clan.members.filter(m => (m.attacks?.length || 0) < war.attacksPerMember);

        let txt = "⚠️ Angreifen!!!\n\n";
        txt += missing.map(m => `👉 ${m.name}`).join("\n");

        interaction.channel.send(txt);

        return interaction.reply({ content: "Gesendet", ephemeral: true });
    }

    // ===== MVP =====
    if (id === "mvp") {
        const war = await getWar();

        const sorted = [...war.clan.members].sort((a, b) => {
            const aStars = (a.attacks || []).reduce((s, x) => s + x.stars, 0);
            const bStars = (b.attacks || []).reduce((s, x) => s + x.stars, 0);
            return bStars - aStars;
        });

        return interaction.reply(`🏆 MVP: ${sorted[0]?.name}`);
    }

    // ===== TARGETS =====
    if (id === "targets") {
        if (!targets.size)
            return interaction.reply("Keine Targets");

        let txt = "🎯 Targets:\n";
        targets.forEach((base, id) => {
            txt += `<@${id}> → Base #${base}\n`;
        });

        return interaction.reply(txt);
    }

    // ===== CLEAR =====
    if (id === "clear") {
        const msgs = await interaction.channel.messages.fetch({ limit: 100 });

        const toDelete = msgs.filter(m =>
            !(m.author.id === client.user.id && m.components.length)
        );

        await interaction.channel.bulkDelete(toDelete, true);

        return interaction.reply({ content: "🧹 Aufgeräumt", ephemeral: true });
    }
});

client.login(TOKEN);