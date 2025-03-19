// withdraw.js
const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('pg');

const app = express();
const port = 3000;

// Database connection details
const connectionDetails = {
    user: 'johndoe',
    host: '145.24.223.208',
    database: 'mass',
    password: 'randompassword',
    port: 5432,
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

// Body parser middleware
app.use(bodyParser.json());

// POST route voor withdraw
app.post('/withdraw-aw', async (req, res) => {
    const { amount } = req.body;

    if (amount) {
        try {
            const query = 'INSERT INTO transacties (bedrag, datum_tijd) VALUES ($1, NOW())';
            await dbClient.query(query, [amount]);

            console.log(`Transactie toegevoegd: Bedrag ${amount} EURO`);
            res.status(200).send('Transactie succesvol toegevoegd');
        } catch (err) {
            console.error('Error inserting transaction into the database:', err.stack);
            res.status(500).send('Error inserting transaction into the database');
        }
    } else {
        res.status(400).send('Bedrag ontbreekt in verzoek');
    }
});

app.listen(port, () => {
    console.log(`Server draait op http://localhost:${port}`);
});
