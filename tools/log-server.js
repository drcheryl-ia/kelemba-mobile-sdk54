// tools/log-server.js — Serveur de réception des logs d'erreur (mode DEV)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9999;
const LOG_FILE = path.join(__dirname, 'kelemba_errors.txt');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const { timestamp, message, stack } = JSON.parse(body);
        const separator = '─'.repeat(60);
        const entry = `[${timestamp}] [ERROR] ${message}\n${
          stack ? `  Stack: ${stack}\n` : ''
        }${separator}\n`;
        fs.appendFileSync(LOG_FILE, entry, 'utf8');
        console.log(`📝 ${message.slice(0, 100)}`);
        res.writeHead(200);
        res.end('OK');
      } catch {
        res.writeHead(400);
        res.end('Bad Request');
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Log server démarré → http://0.0.0.0:${PORT}`);
  console.log(`📄 Fichier : ${LOG_FILE}\n`);
});
