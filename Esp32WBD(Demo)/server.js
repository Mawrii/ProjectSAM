

require("dotenv").config();
const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");
const mysql = require("mysql2/promise");
const axios = require("axios");

const app = express();
const port = process.env.PORT || 8080;
const NOOB_TOKEN = process.env.NOOB_TOKEN;
const NOOB_SERVER = process.env.NOOB_SERVER;
let printerSocket = null;
app.use(cors());
app.use(express.static("public"));
app.use(express.json());
(async () => {
    try {
        const conn = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: process.env.MYSQL_PORT
        });
        await conn.ping(); // Optional but confirms the connection is alive
        console.log("✅ MySQL connection successful");
        await conn.end();
    } catch (err) {
        console.error("❌ MySQL connection failed:", err.message);
    }
})();
async function getConnection() {
    return mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: process.env.MYSQL_PORT
    });
}

// 🔍 Helper: Rekeningnummer lookup
async function lookupRekeningnummer(value) {
    const db = await getConnection();
    try {
        const [rows] = await db.execute("SELECT * FROM Kaart WHERE RekeningNummer = ?", [value]);
        return rows.length > 0;
    } finally {
        await db.end();
    }
}

// Endpoints
app.get("/api/noob/health", (req, res) => {
    res.json({ status: "OK" });
});
app.post("/api/noob/users/getinfo", async (req, res) => {
    const { iban, pin } = req.body;

    if (!iban || !pin) {
        return res.status(400).json({ error: "IBAN and PIN are required" });
    }

    let conn;
    try {
        conn = await getConnection();

        const [rows] = await conn.execute(
            `SELECT k.Pincode, k.attempts_left, r.RekeningNummer, r.Saldo, r.Valuta
             FROM Kaart k
             JOIN Rekening r ON k.RekeningNummer = r.RekeningNummer
             WHERE k.RekeningNummer = ?`,
            [iban]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: "Account not found" });
        }

        const user = rows[0];

        if (user.attempts_left <= 0) {
            return res.status(403).json({ status: "locked", message: "Kaart geblokkeerd. Neem contact op met de bank." });
        }

        if (user.Pincode !== pin) {
            const newAttempts = user.attempts_left - 1;

            await conn.execute(
                `UPDATE Kaart SET attempts_left = ? WHERE RekeningNummer = ?`,
                [newAttempts, iban]
            );

            return res.status(401).json({
                status: "not_found",
                message: `Onjuiste PIN. Pogingen over: ${newAttempts}`
            });
        }

        // Correct PIN: reset attempts_left to max (e.g. 3)
        await conn.execute(
            `UPDATE Kaart SET attempts_left = 3 WHERE RekeningNummer = ?`,
            [iban]
        );

        return res.json({
            iban: user.RekeningNummer,
            saldo: user.Saldo,
            valuta: user.Valuta
        });
    } catch (err) {
        console.error("DB error:", err);
        return res.status(500).json({ error: "Internal server error" });
    } finally {
        if (conn) await conn.end();
    }
});


app.post("/api/noob/users/withdraw", async (req, res) => {
    let { iban, pin, pasnummer, amount } = req.body;
    amount = Number(amount);

    if (!iban || !pin || !pasnummer || isNaN(amount)) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    const db = await getConnection();
    try {
        await db.beginTransaction();
        const [kaartRows] = await db.execute("SELECT * FROM Kaart WHERE RekeningNummer = ? FOR UPDATE", [iban]);

        if (kaartRows.length === 0) {
            await db.rollback();
            return res.status(404).json({ message: "Account not found" });
        }

        const kaart = kaartRows[0];
        if (kaart.attempts_left === 0) {
            await db.rollback();
            return res.status(403).json({ message: "Card locked" });
        }

        const [rekeningRows] = await db.execute("SELECT Saldo FROM Rekening WHERE RekeningNummer = ? FOR UPDATE", [iban]);
        if (rekeningRows[0].Saldo < amount) {
            await db.rollback();
            return res.status(400).json({ message: "Insufficient funds" });
        }

        const newSaldo = rekeningRows[0].Saldo - amount;
        await db.execute("UPDATE Rekening SET Saldo = ? WHERE RekeningNummer = ?", [newSaldo, iban]);
        await db.execute("INSERT INTO Transactie (KlantID, Bedrag, Type) VALUES (?, ?, 'Withdrawal')", [kaart.KlantID, amount]);
        await db.commit();

        return res.json({ message: "Withdrawal successful", newBalance: newSaldo });
    } catch (err) {
        await db.rollback();
        console.error("Withdrawal error:", err);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        await db.end();
    }
});

// WebSocket Server
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const wss = new WebSocket.Server({ server });
const clients = new Map();

wss.on("connection", (ws) => {
    ws.on("message", async (msg) => {
        try {
            const message = JSON.parse(msg.toString());
            console.log("WebSocket message received:", message);


            // Then parse the message
            let data;
            try {
                data = JSON.parse(msg);
            } catch (err) {
                console.error("Invalid JSON:", msg);
                return;
            }
            const role = clients.get(ws);

            if (data.type === "identity") {
                clients.set(ws, data.role);

                // If a web client connects and there's an ESP already connected, send {"type":"scan"} to the ESP
                if (data.role === "web") {
                    for (const [client, role] of clients.entries()) {
                        if (role === "esp" && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ type: "scan" }));
                            console.log('Sent {"type":"scan"} to ESP client');
                        }
                    }
                }

                return;
            }
            if (data.type === "rfid" && role === "esp") {
                const exists = await lookupRekeningnummer(data.rekeningnummer);
                wss.clients.forEach(client => {
                    if (clients.get(client) === "web" && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: "verified",
                            status: exists ? "ok" : "not_found",
                            rekeningnummer: data.rekeningnummer,
                            pasnummer: data.pasnummer
                        }));
                    }
                });
            }
            if (data.type === "pin" && role === "pincode") {
                const db = await getConnection();
                try {
                    const [rows] = await db.execute("SELECT * FROM Kaart WHERE RekeningNummer = ?", [data.rekeningnummer]);
                    if (rows.length === 0) {
                        ws.send(JSON.stringify({ type: "verified", status: "not_found" }));
                        return;
                    }

                    const user = rows[0];
                    if (user.Pincode === data.value) {
                        ws.send(JSON.stringify({
                            type: "verified",
                            status: "ok",
                            name: user.Voornaam,
                            pasnummer: user.pasnummer
                        }));
                    } else {
                        ws.send(JSON.stringify({ type: "verified", status: "not_found" }));
                    }
                } catch (err) {
                    console.error("PIN check error:", err);
                    ws.send(JSON.stringify({ type: "verified", status: "error" }));
                } finally {
                    await db.end();
                }
            }


            if (data.type === "keypad") {
                wss.clients.forEach(client => {
                    if (["pincode", "bedraginvoer", "bevestigen","geldkeuze","bon"].includes(clients.get(client))) {
                        client.send(JSON.stringify({ type: "keypad", value: data.value }));
                    }
                });
            }

            if (data.type === "dispense") {
                wss.clients.forEach(client => {
                    if (clients.get(client) === "esp") {
                        client.send(JSON.stringify(data));
                    }
                });
            }
    if (data.type === 'printer') {
      printerSocket = ws;
      console.log('🖨️ Printer connected.');
      return;
    }

      if (data.type === "bonPrint") {
        wss.clients.forEach(client => {
          if (clients.get(client) === "esp" && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
            console.log("Forwarded bonPrint to ESP client");
          }
        });
        return;
      }
4
        } catch (err) {
            console.error("WebSocket error:", err);
        }
    });

  ws.on("close", () => {
        if (ws === printerSocket) {
      printerSocket = null;
      console.log('🖨️ Printer disconnected.');
    }
  clients.delete(ws);
});

});
