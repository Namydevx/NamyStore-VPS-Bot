const fs = require('fs');
const { execSync } = require('child_process');
const moment = require('moment');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

const limitPath = './db/ovpn_limit.json';
const basePath = '/etc/openvpn';
const pkiPath = path.join(basePath, 'easy-rsa', 'pki');
const easyrsaPath = path.join(basePath, 'easy-rsa', 'easyrsa');
const ovpnTemplatePath = path.join(basePath, 'client-template.ovpn');
const taKeyPath = path.join(basePath, 'ta.key');
const expireLog = path.join(basePath, 'ovpn-expired.db');

if (!fs.existsSync(limitPath)) {
  fs.mkdirSync('./db', { recursive: true });
  fs.writeFileSync(limitPath, '{}');
}

module.exports = async function OpenVpnTrial(msg, client) {
  try {
    const chatId = msg.from;
    const user = 'trial-' + Math.random().toString(36).substring(2, 8);
    const exp = moment().add(1, 'hours').format('YYYY-MM-DD HH:mm');
    const today = moment().format('YYYY-MM-DD');

    // ✅ Cek dan update limit harian
    const limits = JSON.parse(fs.readFileSync(limitPath));
    if (limits[chatId] && limits[chatId].date === today) {
      return msg.reply('⚠️ Kamu sudah membuat 1 akun hari ini. Silakan coba lagi besok.');
    }
    limits[chatId] = { date: today };
    fs.writeFileSync(limitPath, JSON.stringify(limits, null, 2));

    // ✅ Buat sertifikat client dengan Easy-RSA
    console.log('[INFO] Membuat sertifikat client:', user);
    execSync(
      `EASYRSA_PKI=${pkiPath} EASYRSA=${path.dirname(easyrsaPath)} ${easyrsaPath} build-client-full ${user} nopass`,
      { stdio: 'inherit' }
    );

    // ✅ Pastikan semua file yang dibutuhkan ada
    const filesToCheck = [
      ovpnTemplatePath,
      path.join(pkiPath, 'ca.crt'),
      path.join(pkiPath, 'issued', `${user}.crt`),
      path.join(pkiPath, 'private', `${user}.key`),
      taKeyPath
    ];

    for (const file of filesToCheck) {
      if (!fs.existsSync(file)) {
        throw new Error(`File tidak ditemukan: ${file}`);
      }
    }

    // ✅ Baca semua bagian OVPN
    const ovpnTemplate = fs.readFileSync(ovpnTemplatePath, 'utf-8');
    const ca = fs.readFileSync(path.join(pkiPath, 'ca.crt'), 'utf-8');
    const cert = fs.readFileSync(path.join(pkiPath, 'issued', `${user}.crt`), 'utf-8');
    const key = fs.readFileSync(path.join(pkiPath, 'private', `${user}.key`), 'utf-8');
    const tlsAuth = fs.readFileSync(taKeyPath, 'utf-8');

    // ✅ Gabungkan OVPN config
    const ovpnContent = `${ovpnTemplate}

<ca>
${ca}
</ca>

<cert>
${cert}
</cert>

<key>
${key}
</key>

<tls-auth>
${tlsAuth}
</tls-auth>
`;

    // ✅ Simpan ke file .ovpn
    const outputPath = `/tmp/${user}.ovpn`;
    fs.writeFileSync(outputPath, ovpnContent);

    // ✅ Kirim ke user via WhatsApp
    const media = MessageMedia.fromFilePath(outputPath);
    await client.sendMessage(chatId, media, {
      caption: `✅ *Akun OpenVPN Trial Berhasil Dibuat!*\n📆 Expired: ${exp}`
    });

    // ✅ Catat ke log
    fs.appendFileSync(expireLog, `${user} ${exp}\n`);
    console.log('[INFO] Trial OpenVPN dikirim ke:', chatId);

  } catch (err) {
    console.error('❌ ERROR:', err.message);
    await msg.reply(`❌ Gagal membuat akun OpenVPN:\n${err.message}`);
  }
};
