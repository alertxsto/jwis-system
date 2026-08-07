const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();

app.use(express.json());

let sock = null;
let connectionState = 'starting';

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
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      connectionState = 'qr';
      console.log("\nScan QR Code berikut dengan WhatsApp HP kamu:\n");
      qrcode.generate(qr, { small: true });
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
