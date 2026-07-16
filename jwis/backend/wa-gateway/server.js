const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();

app.use(express.json());

let sock = null;

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
      console.log("\nScan QR Code berikut dengan WhatsApp HP kamu:\n");
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
      console.log('Connection closed. Reconnecting...', shouldReconnect);
      if (shouldReconnect) {
        startWA();
      }
    } else if (connection === 'open') {
      console.log('\n======================================');
      console.log('WhatsApp connection opened successfully!');
      console.log('======================================\n');
    }
  });
}

app.post('/api/sessions/:sessionId/messages/send-text', async (req, res) => {
  const { chatId, text } = req.body;
  console.log(`Received request to send to ${chatId}: ${text}`);
  if (!sock) {
    return res.status(503).json({ sent: false, error: "Socket not initialized" });
  }
  try {
    await sock.sendMessage(chatId, { text: text });
    console.log(`Message successfully sent to ${chatId}`);
    res.json({ sent: true, provider: "openwa" });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ sent: false, error: err.message });
  }
});

startWA().then(() => {
  app.listen(2785, '0.0.0.0', () => {
    console.log('WhatsApp Gateway (Baileys) listening on port 2785');
  });
}).catch(err => {
  console.error("Failed to start server:", err);
});
