const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 3000;

const connectionDetails = {
  user: 'johndoe',
  host: '145.24.223.208',
  database: 'mass',
  password: 'randompassword',
  port: 5432,
};

const pool = new Pool(connectionDetails);

app.get('/transacties', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM transacties');
    const transacties = result.rows;
    client.release();
    res.json(transacties);
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).send('Error retrieving data from database');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
