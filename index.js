const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const cron = require('node-cron');
const tesseract = require('tesseract.js');
const handleVmessTrial = require('./handlers/vmessTrial');
const VlessTrial = require('./handlers/VlessTrial');
const TrojanTrial = require('./handlers/TrojanTrial');
const OpenVpnTrial = require('./handlers/OpenVpnTrial');
const ssh = new NodeSSH();

const usedTxPath = './usedPayments.json';
const LIMIT_FILE = './limit.json';

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  },
  webVersionCache: { type: 'none' }
});

client.on('qr', qr => {
  console.log('Scan QR Code:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ Bot siap digunakan!');
});

client.on('auth_failure', msg => {
  console.error('❌ Auth Failure:', msg);
});

client.on('disconnected', reason => {
  console.warn('⚠️ Disconnected:', reason);
});

const sshConfig = {
  host: 'menembusbatas.me',
  username: 'root',
  password: 'Namy1234@MRX',
};

function generatePassword(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const forbiddenWords = [
  'goblok', 'bacot', 'tolol', 'anjing', 'babi', 'asu', 'kontol', 'memek', 'ngentot',
  'bangsat', 'idiot', 'kampret', 'tai', 'spam', 'autu', 'jelek', 'fuck', 'bego', 'noob', 'brengsek'
];

function loadLimit() {
  try {
    if (!fs.existsSync(LIMIT_FILE)) return {};
    return JSON.parse(fs.readFileSync(LIMIT_FILE));
  } catch (err) {
    console.error('❌ Gagal load limit.json:', err);
    return {};
  }
}

function saveLimit(data) {
  fs.writeFileSync(LIMIT_FILE, JSON.stringify(data, null, 2));
}

function hasReachedLimit(senderId) {
  const limit = loadLimit();
  const today = new Date().toISOString().split('T')[0];
  return limit[senderId] === today;
}

function setLimit(senderId) {
  const limit = loadLimit();
  const today = new Date().toISOString().split('T')[0];
  limit[senderId] = today;
  saveLimit(limit);
}

cron.schedule('0 0 * * *', () => {
  fs.writeFileSync(LIMIT_FILE, '{}');
  console.log('✅ limit.json telah direset otomatis pada jam 00:00');
});

function loadUsedPayments() {
  if (!fs.existsSync(usedTxPath)) fs.writeFileSync(usedTxPath, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(usedTxPath));
}

function saveUsedPayment(id) {
  const data = loadUsedPayments();
  data.push(id);
  fs.writeFileSync(usedTxPath, JSON.stringify(data));
}

function hasUsedPayment(id) {
  const data = loadUsedPayments();
  return data.includes(id);
}

client.on('message', async msg => {
  const content = msg.body?.toLowerCase() || '';
  const chat = await msg.getChat();
  const senderId = msg.author || msg.from;

  if (content.startsWith('vmess')) {
    await handleVmessTrial(msg, client);
    return;
  }
  
   if (content.startsWith('vless')) {
    await VlessTrial(msg, client);
    return;
  }

   if (content.startsWith('trojan')) {
   TrojanTrial(msg, client);
  }
 
  if (content.toLowerCase().includes('openvpn')) {
  return OpenVpnTrial(msg, client);
  }


  if (msg.type === 'sticker' && chat.isGroup) {
    await msg.delete(true);
    return chat.sendMessage('🚫 Stiker tidak diperbolehkan di grup ini.');
  }

  if (forbiddenWords.some(word => content.includes(word))) {
    await msg.delete(true);
    return chat.sendMessage('🚫 Pesan mengandung kata terlarang telah dihapus.');
  }

  if (content.startsWith('saya ingin mencoba trial ssh')) {
    if (hasReachedLimit(senderId)) {
      return msg.reply('⚠️ Kamu sudah membuat 1 akun hari ini. Silakan coba lagi besok.');
    }

    const username = 'user' + Math.random().toString(36).substring(2, 8);
    const password = generatePassword();
    const now = new Date();
    const expired = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const expiredDate = expired.toISOString().split('T')[0];
    const expiredWIB = expired.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    const command = `useradd -e "${expiredDate}" -s /bin/false -M ${username} && echo "${username}:${password}" | chpasswd`;

    try {
      await ssh.connect(sshConfig);
      await ssh.execCommand(command);
      setLimit(senderId);

      await msg.reply(`✅ *Akun SSH Trial Berhasil Dibuat:*\n👤 Username: ${username}\n🔐 Password: ${password}\n🌐 Server: ${sshConfig.host}\n⏰ Expired (WIB): ${expiredWIB}\n📡 Port: 80 / 443\n🔗 Protocol: SSH / SSL\n🧪 HTTPCustom:\n${sshConfig.host}:80@${username}:${password}`);
    } catch (err) {
      console.error('❌ SSH ERROR:', err);
      await msg.reply('❌ Gagal membuat akun SSH trial.');
    }
    return;
  }

  if (msg.hasMedia) {
    const media = await msg.downloadMedia();
    if (!media || !media.mimetype.startsWith('image/')) return;

    const base64img = `data:${media.mimetype};base64,${media.data}`;

    try {
      const { data: { text } } = await tesseract.recognize(base64img, 'eng');
      const normalizedText = text.replace(/\s+/g, '').toLowerCase();

      const isValidPayment = (/mahpud/i.test(text) || /mah[a-z]{2,4}/i.test(text)) &&
        (/berhasil|paid|success|lunas/i.test(text) ||
        normalizedText.includes('bankbri') ||
        normalizedText.includes('bankebri'));

      const idMatch =
        text.match(/ID Transaksi[\s@:]*\n?([0-9A-Z]{10,20})/i) ||
        text.match(/No[.\s]*Ref[\s@:]*([0-9A-Z]{10,20})/i) ||
        text.match(/([0-9A-Z]{12,20})/i);

      const transactionId = idMatch ? idMatch[1].trim() : null;

      if (isValidPayment && transactionId) {
        if (hasUsedPayment(transactionId)) {
          return msg.reply('⚠️ Bukti pembayaran ini sudah digunakan sebelumnya.');
        }

        saveUsedPayment(transactionId);

        const username = 'prem' + Math.random().toString(36).substring(2, 6);
        const password = generatePassword();
        const now = new Date();
        const expired = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const expiredDate = expired.toISOString().split('T')[0];
        const expiredWIB = expired.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        const cmd = `useradd -e "${expiredDate}" -s /bin/false -M ${username} && echo "${username}:${password}" | chpasswd`;

        try {
          await ssh.connect(sshConfig);
          await ssh.execCommand(cmd);
          await msg.reply(`🎉 *Akun Freemium Berhasil Dibuat!*\n👤 Username: ${username}\n🔐 Password: ${password}\n🌐 Server: ${sshConfig.host}\n⏰ Aktif s/d: ${expiredWIB}\n📡 Port: 80 / 443\n🔗 Protocol: SSH / SSL\n🧪 HTTPCustom:\n${sshConfig.host}:80@${username}:${password}\nTerima kasih atas dukunganmu!`);
        } catch (err) {
          console.error('❌ SSH ERROR:', err);
          await msg.reply('❌ Gagal membuat akun premium.');
        }
      } else {
        await msg.reply('❌ Bukti bayar tidak valid. Kirim ulang dengan benar.');
      }
    } catch (err) {
      console.error('❌ OCR ERROR:', err);
      await msg.reply('❌ Gagal membaca gambar. Kirim ulang.');
    }
  }
});

client.initialize();
