const { Client } = require('discord.js-selfbot-v13');
const { DiscordStreamClient } = require('discord-stream-client');
const play = require('play-dl');

// MASUKKAN TOKEN AKUN DISCORD BIASA ANDA DI SINI
const TOKEN = 'MASUKKAN_TOKEN_AKUN_ANDA_DISINI';

const client = new Client();
const streamClient = new DiscordStreamClient(client);

// Tempat menyimpan antrean film per server
const queues = new Map();

client.once('ready', () => {
    console.log(`🎬 Bioskop Otomatis Aktif! Menggunakan akun: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    // Abaikan pesan dari akun bot itu sendiri
    if (message.author.id === client.user.id) return;

    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    if (command === 'menu') {
        const menuMessage = 
            `🎬 **Selamat Datang di Bioskop Otomatis** 🎬\n\n` +
            `Ketik perintah ini untuk memicu bot otomatis join & share screen:\n` +
            `👉 \`!sharescreen <link youtube>\` : Otomatis LIVE Video + Suara.\n` +
            `👉 \`!putarlagu <link youtube>\` : Otomatis LIVE Video + Suara.\n`;
        return message.reply(menuMessage);
    }

    if (command === '!putarlagu' || command === '!sharescreen') {
        const url = args[1];
        if (!url || !url.startsWith('http')) {
            return message.reply('❌ Tolong masukkan link YouTube yang valid! Contoh: `!sharescreen https://...`');
        }

        // Cari tahu di Voice Channel mana user yang mengetik perintah berada
        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ Anda harus masuk ke salah satu Voice Channel terlebih dahulu agar bot bisa menyusul!');
        }

        let serverQueue = queues.get(message.guild.id);
        if (!serverQueue) {
            serverQueue = {
                voiceChannel: voiceChannel,
                connection: null,
                broadcaster: null,
                songs: [],
                isPlaying: false
            };
            queues.set(message.guild.id, serverQueue);
        }

        serverQueue.songs.push(url);
        message.reply(`📥 Video dimasukkan ke antrean posisi #${serverQueue.songs.length}`);

        // Jika tidak ada video yang sedang berputar, jalankan bioskopnya
        if (!serverQueue.isPlaying) {
            playNextVideo(message.guild.id, message);
        }
    }
});

async function playNextVideo(guildId, message) {
    const serverQueue = queues.get(guildId);
    
    // Jika antrean kosong, bersihkan koneksi dan keluar channel
    if (!serverQueue || serverQueue.songs.length === 0) {
        if (serverQueue && serverQueue.connection) {
            serverQueue.connection.disconnect();
            console.log("Keluar dari Voice Channel karena antrean habis.");
        }
        queues.delete(guildId);
        return message.channel.send('🎵 Semua antrean video selesai diputar. Bot pamit keluar channel!');
    }

    serverQueue.isPlaying = true;
    const currentUrl = serverQueue.songs[0];

    try {
        message.channel.send(`📺 **[Mulai Memutar]** Mengambil data video YouTube...`);

        // 1. Ekstrak data video dan audio mp4 dari YouTube menggunakan play-dl
        const stream = await play.stream(currentUrl, { quality: 2, format: 'mp4' });

        message.channel.send(`🚀 Bot otomatis join ke **${serverQueue.voiceChannel.name}** & memicu Share Screen (LIVE)...`);

        // 2. PAKSA BOT AUTO-JOIN ke Voice Channel
        const connection = await streamClient.joinVoiceChannel(serverQueue.voiceChannel);
        serverQueue.connection = connection;

        // 3. Buat sinyal paket broadcaster untuk mengirim data gambar
        const broadcaster = connection.createBroadcaster();
        serverQueue.broadcaster = broadcaster;

        // 4. MAIN KAN VIDEO SECARA LIVE (Otomatis memicu tombol "LIVE" ungu di Discord)
        broadcaster.playVideo(stream.stream, {
            fps: 30,
            bitrate: 2500000, // Kualitas 2.5 Mbps biar jernih di server Debian Anda
            type: stream.type
        });

        // Mainkan audio agar sinkron dengan videonya
        broadcaster.playAudio(stream.stream);

        message.channel.send(`🎬 **Bioskop LIVE Sedang Berlangsung!** Silakan klik dua kali pada akun saya untuk menonton.`);

        // 5. EVENT: Jika video selesai, otomatis lanjut ke antrean berikutnya tanpa putus
        broadcaster.on('finish', () => {
            console.log("Video selesai diputar, lanjut antrean berikutnya.");
            serverQueue.songs.shift(); // Hapus video yang baru selesai dari daftar
            serverQueue.isPlaying = false;
            playNextVideo(guildId, message); // Panggil fungsi ini lagi untuk memutar sisa antrean
        });

    } catch (error) {
        console.error("Terjadi error saat memutar:", error);
        message.channel.send(`❌ Gagal memutar video secara otomatis. Skip ke video berikutnya.`);
        serverQueue.songs.shift();
        serverQueue.isPlaying = false;
        playNextVideo(guildId, message);
    }
}

client.login(TOKEN);
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
      
