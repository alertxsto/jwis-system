const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const express = require('express');
const app = express();

app.use(express.json());

let sock = null;
let connectionState = 'starting';
let latestQrDataUrl = null;

function normalizeChatId(chatId) {
  if (!chatId || typeof chatId !== 'string') return '';
  const trimmed = chatId.trim();
  if (trimmed.endsWith('@c.us')) {
    return trimmed.replace('@c.us', '@s.whatsapp.net');
  }
  return trimmed;
}

async function startWA() {
  console.log("Starting WhatsApp socket...");
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
  
  sock = makeWASocket({
    auth: state,
    browser: Browsers.macOS('Desktop'),
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      connectionState = 'qr';
      console.log("\nScan QR Code berikut dengan WhatsApp HP kamu:\n");
      qrcode.generate(qr, { small: true });
      // Expose the QR as a PNG data URL so the dashboard can render it.
      QRCode.toDataURL(qr, { width: 320, margin: 1 })
        .then((url) => { latestQrDataUrl = url; })
        .catch((err) => console.error("QR encode failed:", err));
    }
    if (connection === 'close') {
      connectionState = 'closed';
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
      console.log('Connection closed. Reconnecting...', shouldReconnect);
      if (shouldReconnect) {
        startWA();
      }
    } else if (connection === 'open') {
      connectionState = 'open';
      latestQrDataUrl = null;
      console.log('\n======================================');
      console.log('WhatsApp connection opened successfully!');
      console.log('======================================\n');
    }
  });
}

app.get('/api/health', (req, res) => {
  res.json({
    provider: 'baileys',
    connected: Boolean(sock && connectionState === 'open'),
    state: connectionState,
    message: connectionState === 'open'
      ? 'WhatsApp gateway is connected.'
      : `WhatsApp gateway is ${connectionState}. Scan QR or wait for reconnect.`,
  });
});

app.get('/api/qr', (req, res) => {
  if (connectionState !== 'qr' || !latestQrDataUrl) {
    return res.json({ state: connectionState, qr: null });
  }
  res.json({ state: 'qr', qr: latestQrDataUrl });
});

app.get('/api/groups', async (req, res) => {
  if (!sock || connectionState !== 'open') {
    return res.json({ connected: false, groups: [], message: `Socket not ready (${connectionState}).` });
  }
  try {
    const groupList = await sock.groupFetchAllParticipating();
    const groups = Object.entries(groupList || {}).map(([jid, meta]) => ({
      jid,
      subject: meta?.subject || jid
    }));
    groups.sort((a, b) => (a.subject || '').localeCompare(b.subject || ''));
    res.json({ connected: true, groups, message: `${groups.length} groups found` });
  } catch (err) {
    res.status(500).json({ connected: true, groups: [], message: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  try {
    if (sock) {
      sock.end();
      sock = null;
    }
  } catch (err) {
    console.error("Logout cleanup error:", err);
  }
  try {
    fs.rmSync('baileys_auth_info', { recursive: true, force: true });
  } catch (err) {
    console.error("Auth folder cleanup error:", err);
  }
  connectionState = 'starting';
  latestQrDataUrl = null;
  startWA().catch((err) => console.error("Failed to restart socket:", err));
  res.json({ logged_out: true, state: connectionState });
});

app.post('/api/sessions/:sessionId/messages/send-text', async (req, res) => {
  const { chatId, text } = req.body;
  const targetChatId = normalizeChatId(chatId);
  console.log(`Received request to send to ${chatId} normalized as ${targetChatId}: ${text}`);
  if (!targetChatId) {
    return res.status(400).json({ sent: false, provider: "baileys", error: "Missing chatId" });
  }
  if (!text) {
    return res.status(400).json({ sent: false, provider: "baileys", error: "Missing text" });
  }
  if (!sock || connectionState !== 'open') {
    return res.status(503).json({
      sent: false,
      provider: "baileys",
      error: `Socket not ready (${connectionState}). Scan QR or wait for reconnect.`
    });
  }
  try {
    await sock.sendMessage(targetChatId, { text: text });
    console.log(`Message successfully sent to ${targetChatId}`);
    res.json({ sent: true, provider: "baileys", message: "WhatsApp message sent.", chatId: targetChatId });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ sent: false, provider: "baileys", error: err.message });
  }
});

startWA().then(() => {
  app.listen(2785, '0.0.0.0', () => {
    console.log('WhatsApp Gateway (Baileys) listening on port 2785');
  });
}).catch(err => {
  console.error("Failed to start server:", err);
});
