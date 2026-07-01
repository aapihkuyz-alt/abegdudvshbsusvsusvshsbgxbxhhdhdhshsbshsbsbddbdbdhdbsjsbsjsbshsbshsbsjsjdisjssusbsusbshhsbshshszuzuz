const { Client, GatewayIntentBits } = require('discord.js');
const { StreamClient } = require('discord-stream-client'); // Library khusus share screen
const play = require('play-dl');

const TOKEN = 'MASUKKAN_TOKEN_BOT_DISCORD_ANDA_DISINI';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Inisialisasi Stream Client untuk fitur Share Screen Video
const streamClient = new StreamClient(client);

// Struktur data antrean
const queues = new Map();

client.once('ready', () => {
    console.log(`🎬 Bot Bioskop SHARE SCREEN aktif sebagai: ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    if (command === 'menu') {
        const menuMessage = 
            `🎬 **Selamat Datang di Bioskop Real Video** 🎬\n\n` +
            `Gunakan perintah berikut untuk menonton bareng:\n` +
            `👉 \`!sharescreen <link youtube>\` : Memutar VIDEO + SUARA ke voice channel.\n` +
            `👉 \`!putarlagu <link youtube>\` : Memutar VIDEO + SUARA ke voice channel.\n\n` +
            `*Sekarang bot akan otomatis melakukan share screen layaknya user biasa.*`;
        return message.reply(menuMessage);
    }

    if (command === '!putarlagu' || command === '!sharescreen') {
        const url = args[1];
        if (!url) return message.reply('❌ Masukkan link YouTube! Contoh: `!sharescreen https://...`');

        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) return message.reply('❌ Anda harus masuk ke Voice Channel dulu!');

        let serverQueue = queues.get(message.guild.id);
        if (!serverQueue) {
            serverQueue = {
                voiceChannel: voiceChannel,
                connection: null,
                songs: [],
                isPlaying: false
            };
            queues.set(message.guild.id, serverQueue);
        }

        serverQueue.songs.push(url);
        message.reply(`📥 Video masuk antrean posisi #${serverQueue.songs.length}`);

        if (!serverQueue.isPlaying) {
            startQueue(message.guild.id, message);
        }
    }
});

async function startQueue(guildId, message) {
    const serverQueue = queues.get(guildId);
    if (!serverQueue || serverQueue.songs.length === 0) {
        if (serverQueue && serverQueue.connection) {
            serverQueue.connection.disconnect();
        }
        queues.delete(guildId);
        return message.channel.send('🎵 Semua antrean film/video sudah selesai diputar.');
    }

    serverQueue.isPlaying = true;
    const currentUrl = serverQueue.songs[0];

    try {
        message.channel.send(`📺 Mulai memutar & Share Screen: <${currentUrl}>`);

        // 1. Dapatkan stream video dan audio dari YouTube menggunakan play-dl
        const videoInfo = await play.video_info(currentUrl);
        const stream = await play.stream(currentUrl, { quality: 2, format: 'mp4' });

        // 2. Koneksikan Stream Client ke Voice Channel (Ini yang memicu tombol "LIVE" / Share Screen)
        const connection = await streamClient.joinVoiceChannel(serverQueue.voiceChannel);
        serverQueue.connection = connection;

        // 3. Buat UDP Broadcaster untuk mengirimkan gambar dan suara sekaligus
        const streamer = connection.createBroadcaster();
        
        // Memutar video ke Discord Share Screen
        streamer.playVideo(stream.stream, {
            fps: 30,
            bitrate: 2000000 // 2 Mbps untuk kualitas jernih
        });

        // Memutar audio agar sinkron dengan video
        streamer.playAudio(stream.stream);

        // 4. Jika video selesai, lanjut ke antrean berikutnya
        streamer.on('finish', () => {
            serverQueue.songs.shift(); // Hapus video yang baru selesai
            serverQueue.isPlaying = false;
            startQueue(guildId, message); // Putar antrean selanjutnya
        });

    } catch (error) {
        console.error(error);
        message.channel.send(`❌ Gagal memutar video ini. Skip ke antrean berikutnya.`);
        serverQueue.songs.shift();
        serverQueue.isPlaying = false;
        startQueue(guildId, message);
    }
}

client.login(TOKEN);
      
