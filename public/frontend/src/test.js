const express = require('express');
const app = express();
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');

// Database connection details
const connectionDetails = {
    user: 'johndoe',
    host: '145.24.223.208',
    database: 'mass',
    password: 'randompassword',
    port: 5432, // Default PostgreSQL port
};

// Create a new pool instance
const pool = new Pool(connectionDetails);

// Enable CORS
app.use(cors());
app.use(bodyParser.json());
// Middleware to parse JSON bodies

app.use(express.json());

// Endpoint to handle the accountinfo request
app.post('/api/accountinfo', async (req, res) => {
    try {
        // Extract the "target" parameter from the query string
        const target = req.query.target;

        // Extract UID and PIN code from the request body
        const { uid, pincode } = req.body;
       
        // Validate if target, UID, and PIN code are provided and have correct lengths
        if (!target || !uid || !pincode || uid.length !== 8 || pincode.length !== 4 || target.length !== 18) {
            return res.status(400).json({ error: "Bad Request" });
        }

        // Check if attempts_remaining is above 0
        const attemptsQuery = {
            text: 'SELECT attempts_remaining FROM pogingen WHERE rekeningnummer = $1',
            values: [target],
        };
        const attemptsResult = await pool.query(attemptsQuery);

        if (attemptsResult.rows.length === 0) {
            return res.status(404).json({ error: "Bestaat IBAN? Bestaat Bank?" });
        }

        const attempts_remaining = attemptsResult.rows[0].attempts_remaining;

        if (attempts_remaining <= 0) {
            return res.status(403).json({ error: "Kaart is geblokkeerd" });
        }

        // Query to check if the provided UID and PIN code match any record in the 'kaarten' table
        const kaartenQuery = {
            text: 'SELECT amount, klant_id FROM kaarten WHERE rekeningnummer = $1 AND uid = $2 AND pincode = $3',
            values: [target, uid, pincode],
        };
        const kaartenResult = await pool.query(kaartenQuery);

        // If no matching record found, handle accordingly
        if (kaartenResult.rows.length === 0) {
            // Decrease attempts_remaining in 'pogingen' table
            await pool.query('UPDATE pogingen SET attempts_remaining = attempts_remaining - 1 WHERE rekeningnummer = $1', [target]);

            // Check updated attempts_remaining
            const updatedAttemptsResult = await pool.query(attemptsQuery);
            const updatedAttemptsRemaining = updatedAttemptsResult.rows[0].attempts_remaining;

            if (updatedAttemptsRemaining <= 0) {
                return res.status(403).json({ error: "Kaart is geblokkeerd" });
            }

            return res.status(401).json({ error: "Correcte Pincode?", attempts_remaining: updatedAttemptsRemaining });
        }

        // Retrieve klant_id from the matched kaarten record
        const { amount, klant_id } = kaartenResult.rows[0];

        // Query to retrieve additional data from the 'klanten' table based on klant_id
        const klantenQuery = {
            text: 'SELECT naam FROM klanten WHERE klant_id = $1',
            values: [klant_id],
        };

        // Execute the query
        const klantenResult = await pool.query(klantenQuery);

        // Combine data from 'kaarten' and 'klanten' tables
        const result = {
            amount: amount,
            naam: klantenResult.rows[0].naam,
        };

        // Return the combined data with 200 OK status
        res.status(200).json(result);
        console.log(result);
    } catch (error) {
        console.error('Error querying the database:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Endpoint to handle the withdrawal request
app.post('/api/withdraw', async (req, res) => {
    try {
        // Extract the "target" parameter from the query string
        const target = req.query.target;

        // Extract UID and amount from the request body
        const { uid, amount } = req.body;

        // Validate if target, UID, and amount are provided
        if (!target || !uid || !amount || uid.length !== 8 ) {
            return res.status(400).json({ error: "Bad Request" });
        }

        // Check attempts_remaining
        const attemptsQuery = {
            text: 'SELECT attempts_remaining FROM pogingen WHERE rekeningnummer = $1',
            values: [target],
        };
        const attemptsResult = await pool.query(attemptsQuery);
        if (attemptsResult.rows.length === 0 || attemptsResult.rows[0].attempts_remaining <= 0) {
            return res.status(403).json({ error: "Kaart is geblokkeerd" });
        }

        // Query to check if the provided target exists and retrieve amount
        const kaartenQuery = {
            text: 'SELECT amount FROM kaarten WHERE rekeningnummer = $1 AND uid = $2',
            values: [target, uid],
        };
        const kaartenResult = await pool.query(kaartenQuery);

        // If no matching record found, return 404 Not Found
        if (kaartenResult.rows.length === 0) {
            return res.status(404).json({ error: "Bestaat IBAN? Bestaat Bank?" });
        }

        const currentAmount = kaartenResult.rows[0].amount;

        // Check if there's enough balance to withdraw
        if (currentAmount < amount) {
            return res.status(400).json({ error: "Insufficient balance" });
        }

        // Subtract the amount from the current balance
        const newAmount = currentAmount - amount;

        // Update the amount in the kaarten table
        await pool.query('UPDATE kaarten SET amount = $1 WHERE rekeningnummer = $2 AND uid = $3', [newAmount, target, uid]);

        // Insert the transaction record in the transacties table
        await pool.query('INSERT INTO transacties (rekeningnummer, datum_tijd, bank, bedrag) VALUES ($1, NOW(), $2, $3)', [target, 'MASB', amount]);

        // Respond with the updated amount
        res.status(200).json({ newAmount });
        console.log('Nieuw bedrag op rekening '+ target + ' : ' + newAmount);
    } catch (error) {
        console.error('Error querying the database:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
app.post('/api/pincode', async (req, res) => {
    try {
        const { rekeningnummer, pincode } = req.body;
        // Query to retrieve the pin code from the database
        const query = {
            text: 'SELECT pincode FROM kaarten WHERE rekeningnummer = $1',
            values: [rekeningnummer],
        };

        const result = await pool.query(query);

        // Check if a matching record is found
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Rekeningnummer not found" });
        }

        const storedPin = result.rows[0].pincode;

        // Compare the entered pin code with the one stored in the database
        if (pincode === storedPin) {
            return res.status(200).json({ message: "Pin code matches" });
        } else {
            // Update the pin code in the database
            await pool.query('UPDATE kaarten SET pincode = $1 WHERE rekeningnummer = $2', [pincode, rekeningnummer]);
            return res.status(200).json({ message: "Pin code updated successfully" });
        }
    } catch (error) {
        console.error('Error querying the database:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


app.get('/api/noob/health', (req, res) => {
    res.json({ status: 'OK' });
}); 



  
 
  
// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
