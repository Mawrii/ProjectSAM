const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  console.log('New WebSocket connection');

  ws.on('message', message => {
    const key = message.toString(); // Ensure the message is treated as a string
    console.log('Received key:', key);
    broadcast(key); // Send key to all connected WebSocket clients
  });
});

// Broadcast function to send a message to all connected clients
function broadcast(key) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(key);
    }
  });
}

const PORT = 8091;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is listening on port ${PORT}`);
});