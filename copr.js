const { Client } = require('discord.js-selfbot-v13');
const { DiscordStreamClient } = require('discord-stream-client');
const puppeteer = require('puppeteer');

// MASUKKAN TOKEN AKUN DISCORD BIASA ANDA DI SINI
const TOKEN = 'MASUKKAN_TOKEN_AKUN_ANDA_DISINI';

const client = new Client();
const streamClient = new DiscordStreamClient(client);

const queues = new Map();

client.once('ready', () => {
    console.log(`🎬 Bioskop Browser LIVE Aktif! Akun: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.id === client.user.id) return;

    const args = message.content.split(' ');
    const command = args.toLowerCase();

    if (command === 'menu') {
        const menuMessage = 
            `🎬 **Selamat Datang di Bioskop Browser** 🎬\n\n` +
            `Bot akan membuka browser internal secara langsung tanpa mengunduh:\n` +
            `👉 \`!sharescreen <link youtube>\` : Buka link di browser & Share Screen otomatis.\n` +
            `👉 \`!putarlagu <link youtube>\` : Buka link di browser & Share Screen otomatis.\n`;
        return message.reply(menuMessage);
    }

    if (command === '!putarlagu' || command === '!sharescreen') {
        const url = args;
        if (!url || !url.startsWith('http')) {
            return message.reply('❌ Masukkan link video/YouTube yang valid!');
        }

        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ Masuklah ke Voice Channel terlebih dahulu!');
        }

        let serverQueue = queues.get(message.guild.id);
        if (!serverQueue) {
            serverQueue = {
                voiceChannel: voiceChannel,
                connection: null,
                browser: null,
                page: null,
                songs: [],
                isPlaying: false
            };
            queues.set(message.guild.id, serverQueue);
        }

        serverQueue.songs.push(url);
        message.reply(`📥 Link dimasukkan ke antrean posisi #${serverQueue.songs.length}`);

        if (!serverQueue.isPlaying) {
            streamFromBrowser(message.guild.id, message);
        }
    }
});

async function streamFromBrowser(guildId, message) {
    const serverQueue = queues.get(guildId);
    
    if (!serverQueue || serverQueue.songs.length === 0) {
        if (serverQueue) {
            if (serverQueue.browser) await serverQueue.browser.close();
            if (serverQueue.connection) serverQueue.connection.disconnect();
        }
        queues.delete(guildId);
        return message.channel.send('🎵 Antrean habis. Browser ditutup dan bot keluar channel!');
    }

    serverQueue.isPlaying = true;
    const currentUrl = serverQueue.songs;

    try {
        message.channel.send(`🌐 **[Browser]** Membuka Google Chrome background untuk link: <${currentUrl}>...`);

        // 1. Jalankan Browser Chromium secara Headless (Background tanpa monitor)
        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium', // Jalur chromium di Debian
            headless: "new",
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--autoplay-policy=no-user-gesture-required', // Paksa video auto-play tanpa klik
                '--use-fake-ui-for-media-stream'
            ]
        });
        serverQueue.browser = browser;

        const page = await browser.newPage();
        serverQueue.page = page;

        // Set ukuran layar browser (resolusi bioskop)
        await page.setViewport({ width: 1280, height: 720 });
        await page.goto(currentUrl, { waitUntil: 'networkidle2' });

        // Trik bypass tombol play YouTube jika tertahan otomatis
        try {
            await page.click('.ytp-large-play-button');
        } catch(e) { /* Abaikan jika video sudah jalan otomatis */ }

        message.channel.send(`🚀 Menghubungkan Browser ke Voice Channel **${serverQueue.voiceChannel.name}**...`);

        // 2. Akun masuk otomatis ke Voice Channel
        const connection = await streamClient.joinVoiceChannel(serverQueue.voiceChannel);
        serverQueue.connection = connection;

        // 3. Tangkap screen stream dari page browser menggunakan Broadcaster
        const broadcaster = connection.createBroadcaster();
        
        // Membaca frame visual dari browser secara real-time (30 FPS)
        setInterval(async () => {
            if (browser.connected) {
                const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 });
                broadcaster.sendVideoFrame(screenshot);
            }
        }, 1000 / 30); // Berjalan di 30 FPS

        message.channel.send(`🎬 **Bioskop Browser LIVE!** Silakan klik profil saya untuk menonton langsung dari browser server.`);

        // 4. Deteksi jika video di YouTube browser sudah selesai (Durasi habis)
        await page.waitForFunction(() => {
            const video = document.querySelector('video');
            return video && video.ended;
        }, { timeout: 0 }); // Menunggu sampai video benar-benar tamat

        // 5. Lanjut Antrean Berikutnya jika video tamat
        console.log("Video di browser selesai, lanjut antrean.");
        await browser.close();
        serverQueue.songs.shift();
        serverQueue.isPlaying = false;
        streamFromBrowser(guildId, message);

    } catch (error) {
        console.error(error);
        message.channel.send(`❌ Browser error atau link bermasalah. Skip ke antrean berikutnya.`);
        if (serverQueue.browser) await serverQueue.browser.close();
        serverQueue.songs.shift();
        serverQueue.isPlaying = false;
        streamFromBrowser(guildId, message);
    }
}

client.login(TOKEN);
