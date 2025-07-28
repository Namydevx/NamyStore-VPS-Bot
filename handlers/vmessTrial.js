const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { execSync } = require('child_process');

const limitPath = './db/vmess_limit.json';

// Buat folder dan file jika belum ada
if (!fs.existsSync(limitPath)) {
  fs.mkdirSync('./db', { recursive: true });
  fs.writeFileSync(limitPath, '{}');
}

module.exports = async function handleVmessTrial(msg, client) {
  try {
    const chatId = msg.from;
    const limits = JSON.parse(fs.readFileSync(limitPath));
    const today = moment().format('YYYY-MM-DD');

    // 🚫 Cek apakah user sudah buat akun hari ini
    if (limits[chatId] && limits[chatId].date === today) {
      return msg.reply('⚠️ Kamu sudah membuat 1 akun hari ini. Silakan coba lagi besok.');
    }

    const user = 'trial-' + Math.random().toString(36).substring(2, 8);
    const uuid = uuidv4();
    const domain = 'menembusbatas.me';
    const exp = moment().add(1, 'hours').format('YYYY-MM-DD HH:mm'); // expired 1 jam

    // 🔓 Non-TLS
    const vmessNonTLS = {
      v: '2',
      ps: user,
      add: domain,
      port: '80',
      id: uuid,
      aid: '0',
      net: 'ws',
      type: 'none',
      host: domain,
      path: '/vmess',
      tls: 'none'
    };
    const linkNonTLS = 'vmess://' + Buffer.from(JSON.stringify(vmessNonTLS)).toString('base64');

    // 🔐 TLS
    const vmessTLS = {
      v: '2',
      ps: user,
      add: domain,
      port: '443',
      id: uuid,
      aid: '0',
      net: 'ws',
      type: 'none',
      host: domain,
      path: '/vmess',
      tls: 'tls'
    };
    const linkTLS = 'vmess://' + Buffer.from(JSON.stringify(vmessTLS)).toString('base64');

    // 🔁 Tambahkan ke config Xray
    const configPath = '/etc/xray/config.json';
    const config = JSON.parse(fs.readFileSync(configPath));

    const vmessInbound = config.inbounds.find(i =>
      i.protocol === 'vmess' &&
      i.streamSettings?.network === 'ws' &&
      i.streamSettings.wsSettings?.path === '/vmess'
    );

    if (!vmessInbound) throw new Error('Inbound VMess WS /vmess tidak ditemukan!');

    vmessInbound.settings.clients.push({
      id: uuid,
      alterId: 0,
      email: user
    });

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    execSync('systemctl restart xray');

    // 💾 Simpan limit user hari ini
    limits[chatId] = { date: today };
    fs.writeFileSync(limitPath, JSON.stringify(limits, null, 2));

    // 📨 Kirim pesan
    const message = `
✅ *Akun VMess Trial berhasil dibuat!*

👤 *Username:* ${user}
🆔 *UUID:* ${uuid}
🌐 *Domain:* ${domain}
📆 *Expired:* ${exp}

🔓 *Non-TLS (Port 80):*
\`\`\`
${linkNonTLS}
\`\`\`

🔐 *TLS (Port 443):*
\`\`\`
${linkTLS}
\`\`\`
`.trim();

    await msg.reply(message);

  } catch (err) {
    console.error('❌ ERROR:', err.message);
    await msg.reply(`❌ Gagal membuat VMess: ${err.message}`);
  }
};
