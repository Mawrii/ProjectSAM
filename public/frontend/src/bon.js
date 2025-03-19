const WebSocket = require('ws');
const { Client } = require('pg');

// Database connection details
const connectionDetails = {
    user: 'johndoe',
    host: '145.24.223.208',
    database: 'mass',
    password: 'randompassword',
    port: 5432, // Default PostgreSQL port
};

// Connect to the database
const dbClient = new Client(connectionDetails);

dbClient.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database');
});

// WebSocket server for clients
const wssClients = new WebSocket.Server({ port: 8081 });

// ESP32 WebSocket client
let esp32Socket = null;

wssClients.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        if (message == 'printBon') {
            // Query data from the database
            dbClient.query('SELECT rekeningnummer FROM kaarten LIMIT 1', (err, res) => {
                if (err) {
                    console.error('Error fetching data from database:', err.stack);
                    ws.send('Error fetching data from database');
                    return;
                }

                if (res.rows.length > 0) {
                    const rekeningnummer = res.rows[0].rekeningnummer;
                    ws.send(`Rekeningnummer: ${rekeningnummer}`);
                    console.log(`Sent rekeningnummer to web client: ${rekeningnummer}`);

                    // Forward the data to the ESP32 if connected
                    if (esp32Socket && esp32Socket.readyState == WebSocket.OPEN) {
                        esp32Socket.send(rekeningnummer);
                        console.log(`Forwarded rekeningnummer to ESP32: ${rekeningnummer}`);
                    } else {
                        console.log('ESP32 is not connected');
                    }
                } else {
                    ws.send('No data found');
                    console.log('No data found');
                }
            });
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// WebSocket server for the ESP32
const wssEsp32 = new WebSocket.Server({ port: 8082 });

wssEsp32.on('connection', (ws) => {
    console.log('ESP32 connected');
    esp32Socket = ws;

    ws.on('close', () => {
        console.log('ESP32 disconnected');
        esp32Socket = null;
    });
});

console.log('WebSocket servers are running on ws://145.24.223.208:8080 (clients) and ws://145.24.223.208:8081 (ESP32)');
