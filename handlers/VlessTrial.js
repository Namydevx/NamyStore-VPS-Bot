const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { execSync } = require('child_process');

const limitPath = './db/vless_limit.json';

// Buat folder dan file limit jika belum ada
if (!fs.existsSync(limitPath)) {
  fs.mkdirSync('./db', { recursive: true });
  fs.writeFileSync(limitPath, '{}');
}

module.exports = async function VlessTrial(msg, client) {
  try {
    const chatId = msg.from;
    const user = 'trial-' + Math.random().toString(36).substring(2, 8);
    const uuid = uuidv4();
    const domain = 'menembusbatas.me';
    const exp = moment().add(1, 'hours').format('YYYY-MM-DD HH:mm'); // 1 jam

    const limits = JSON.parse(fs.readFileSync(limitPath));
    const today = moment().format('YYYY-MM-DD');

    // Cek limit harian
    if (limits[chatId] && limits[chatId].date === today) {
      return msg.reply('⚠️ Kamu sudah membuat 1 akun hari ini. Silakan coba lagi besok.');
    }

    // Simpan data limit
    limits[chatId] = { date: today };
    fs.writeFileSync(limitPath, JSON.stringify(limits, null, 2));

    // Konfigurasi VLESS
    const vlessNonTLS = `vless://${uuid}@${domain}:80?type=ws&path=/vless&encryption=none#${user}`;
    const vlessTLS = `vless://${uuid}@${domain}:443?type=ws&security=tls&path=/vless&encryption=none#${user}`;

    // Baca config Xray
    const configPath = '/etc/xray/config.json';
    const config = JSON.parse(fs.readFileSync(configPath));

    // Cari inbound VLESS dengan path "/vless"
    const vlessInbound = config.inbounds.find(i =>
      i.protocol === 'vless' &&
      i.streamSettings?.network === 'ws' &&
      i.streamSettings.wsSettings?.path === '/vless'
    );

    if (!vlessInbound) throw new Error('Inbound VLESS WS /vless tidak ditemukan!');

    // Tambahkan client
    vlessInbound.settings.clients.push({
      id: uuid,
      email: user,
      expiry: moment().add(1, 'hours').toISOString()
    });

    // Tulis ulang config dan restart Xray
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    execSync('systemctl restart xray');

    const message = `
✅ *Akun VLESS Trial berhasil dibuat!*

👤 *Username:* ${user}
🆔 *UUID:* ${uuid}
🌐 *Domain:* ${domain}
📆 *Expired:* ${exp}

🔓 *VLESS Non-TLS (Port 80):*
\`\`\`
${vlessNonTLS}
\`\`\`

🔐 *VLESS TLS (Port 443):*
\`\`\`
${vlessTLS}
\`\`\`
`.trim();

    await msg.reply(message);

  } catch (err) {
    console.error('❌ ERROR:', err.message);
    await msg.reply(`❌ Gagal membuat VLESS: ${err.message}`);
  }
};
