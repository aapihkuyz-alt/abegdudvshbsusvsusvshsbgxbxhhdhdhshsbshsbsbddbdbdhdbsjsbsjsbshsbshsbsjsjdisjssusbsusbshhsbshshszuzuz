const { Client } = require('discord.js-selfbot-v13');
const { DiscordStreamClient } = require('discord-stream-client');
const { exec } = require('child_process');

const client = new Client();
const streamClient = new DiscordStreamClient(client);

// Token Akun Discord (Gunakan token akun tumbal/alternatif agar aman)
const TOKEN = 'TOKEN_AKUN_DISCORD_KAMU'; 

client.on('ready', async () => {
  console.log(`Bot berhasil aktif sebagai: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Contoh command: !play https://youtube.com
  if (message.content.startsWith('!play ')) {
    const url = message.content.split(' ')[1];
    
    // Pastikan user berada di Voice Channel
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
      return message.reply('Kamu harus masuk ke Voice Channel terlebih dahulu!');
    }

    message.reply('Sedang menyiapkan video, mohon tunggu...');

    // Ambil direct video link dari YouTube menggunakan yt-dlp
    exec(`yt-dlp -g -f "best[ext=mp4]" "${url}"`, async (error, stdout, stderr) => {
      if (error) {
        return message.reply('Gagal mengambil video dari URL tersebut.');
      }

      const videoStreamUrl = stdout.trim();

      try {
        // Bot bergabung ke Voice Channel dan mulai Share Screen
        const connection = await streamClient.joinVoiceChannel(voiceChannel);
        const streamer = await connection.createStream();

        // Putar videoStreamUrl menggunakan FFmpeg bawaan library
        streamer.play(videoStreamUrl, {
          type: 'ffmpeg',
          fps: 85,
          bitrate: 5000 // Sesuaikan dengan spesifikasi VPS dan internet
        });

        message.reply(`Sekarang menyiarkan video ke layar!`);
      } catch (err) {
        console.error(err);
        message.reply('Terjadi kesalahan saat mencoba membagikan layar.');
      }
    });
  }
});

client.login(TOKEN);
