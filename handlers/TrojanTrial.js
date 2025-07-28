const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { execSync } = require('child_process');

const limitPath = './db/trojan_limit.json';

// Buat folder dan file limit jika belum ada
if (!fs.existsSync(limitPath)) {
  fs.mkdirSync('./db', { recursive: true });
  fs.writeFileSync(limitPath, '{}');
}

module.exports = async function TrojanTrial(msg, client) {
  try {
    const chatId = msg.from;
    const user = 'trial-' + Math.random().toString(36).substring(2, 8);
    const password = uuidv4(); // UUID digunakan sebagai password
    const domain = 'menembusbatas.me';
    const exp = moment().add(1, 'hours').format('YYYY-MM-DD HH:mm');

    const limits = JSON.parse(fs.readFileSync(limitPath));
    const today = moment().format('YYYY-MM-DD');

    // Cek limit harian
    if (limits[chatId] && limits[chatId].date === today) {
      return msg.reply('⚠️ Kamu sudah membuat 1 akun hari ini. Silakan coba lagi besok.');
    }

    // Simpan data limit
    limits[chatId] = { date: today };
    fs.writeFileSync(limitPath, JSON.stringify(limits, null, 2));

    // Generate links
    const trojanWS = `trojan://${password}@${domain}:443?type=ws&security=tls&host=${domain}&path=/trojan-ws#${user}`;
    const trojanGRPC = `trojan://${password}@${domain}:443?mode=gun&security=tls&type=grpc&serviceName=trojan-grpc&sni=${domain}#${user}`;
    const trojanNoneTLS = `trojan://${password}@${domain}:80?type=ws&security=none&host=${domain}&path=/trojan-ws#${user}`;

    // Update config.json
    const configPath = '/etc/xray/config.json';
    const config = JSON.parse(fs.readFileSync(configPath));

    const trojanInbound = config.inbounds.find(i =>
      i.protocol === 'trojan' &&
      i.streamSettings?.network === 'ws' &&
      i.streamSettings.wsSettings?.path === '/trojan-ws'
    );

    if (!trojanInbound) throw new Error('Inbound Trojan WS /trojan-ws tidak ditemukan!');

    trojanInbound.settings.clients.push({
      password,
      email: user
    });

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    execSync('systemctl restart xray');

    const replyMsg = `
✅ *Akun Trojan Trial berhasil dibuat!*

👤 *Username:* ${user}
🔑 *Password:* ${password}
🌐 *Domain:* ${domain}
📅 *Expired:* ${exp}

🔓 *Trojan Non-TLS (Port 80):*
\`\`\`
${trojanNoneTLS}
\`\`\`

🔐 *Trojan TLS (Port 443):*
\`\`\`
${trojanWS}
\`\`\`

🟣 *Trojan gRPC (443):*
\`\`\`
${trojanGRPC}
\`\`\`
`.trim();

    await msg.reply(replyMsg);
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    await msg.reply(`❌ Gagal membuat akun Trojan: ${err.message}`);
  }
};
