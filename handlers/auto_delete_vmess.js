const fs = require('fs');
const moment = require('moment');
const { execSync } = require('child_process');

const configPath = '/etc/xray/config.json';
const usersPath = './db/vmess_users.json';

// Load data user
if (!fs.existsSync(usersPath)) process.exit();
const users = JSON.parse(fs.readFileSync(usersPath));
if (users.length === 0) process.exit();

// Load config
const config = JSON.parse(fs.readFileSync(configPath));
const vmessInbound = config.inbounds.find(i =>
  i.protocol === 'vmess' &&
  i.streamSettings?.network === 'ws' &&
  i.streamSettings.wsSettings?.path === '/vmess'
);

if (!vmessInbound) {
  console.error('❌ Inbound /vmess tidak ditemukan.');
  process.exit();
}

const now = moment();
const remainingUsers = [];

for (const user of users) {
  const expired = moment(user.expired_at);
  if (now.isAfter(expired)) {
    console.log(`🗑️ Menghapus ${user.email} (expired at ${expired.format()})`);
    vmessInbound.settings.clients = vmessInbound.settings.clients.filter(c => c.email !== user.email);
  } else {
    remainingUsers.push(user); // Masih aktif
  }
}

// Simpan kembali config jika ada yang dihapus
if (remainingUsers.length !== users.length) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  execSync('systemctl restart xray');
  fs.writeFileSync(usersPath, JSON.stringify(remainingUsers, null, 2));
  console.log('✅ Xray di-restart dan user expired dihapus.');
} else {
  console.log('⏳ Tidak ada user expired.');
}
