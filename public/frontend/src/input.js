const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const pool = new Pool({
  user: 'johndoe',
  host: '145.24.223.208',
  database: 'mass',
  password: 'randompassword',
  port: 5432,
});

app.use(express.static(path.join(__dirname, 'public')));

let esp32Socket = null;
let webPageSocket = null;

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const msg = message.toString().trim();
    console.log('Received message:', msg);

    if (msg === 'Send PasDet') {
      if (!esp32Socket) {
        esp32Socket = ws;
        console.log('ESP32 connected');
      } else if (!webPageSocket) {
        webPageSocket = ws;
        console.log('WebPage connected');
        webPageSocket.send('Send PasDet');
      }
    } else {
      const parts = msg.split(':');
      if (parts.length !== 2) {
        console.log('Invalid message format');
        return ws.send('Invalid message format');
      }

      const uid = parts[0].toUpperCase();
      const rekeningnummer = parts[1];

      try {
        const startTime = Date.now();
        const query = 'SELECT * FROM kaarten WHERE rekeningnummer = $1 AND uid = $2';
        const values = [rekeningnummer, uid];
        const res = await pool.query(query, values);
        const queryTime = Date.now() - startTime;
        console.log(`Query execution time: ${queryTime}ms`);

        if (res.rowCount > 0) {
          console.log('Key exists');
          ws.send('Key exists');
          if (webPageSocket) {
            webPageSocket.send(JSON.stringify({ action: 'Redirect', iban: rekeningnummer, uid: uid }));
          }
        } else {
          console.log('Key does not exist');
          ws.send('404: Key does not exist');
        }
      } catch (err) {
        console.error('Database error:', err);
        ws.send('500: Internal Server Error');
      }
    }
  });

  ws.on('close', () => {
    if (ws === esp32Socket) {
      esp32Socket = null;
      console.log('ESP32 disconnected');
    } else if (ws === webPageSocket) {
      webPageSocket = null;
      console.log('WebPage disconnected');
    }
  });
});

const PORT = 8090;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is listening on port ${PORT}`);
});
