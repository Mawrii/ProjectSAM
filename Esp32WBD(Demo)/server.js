// Load environment variables
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
// 🔍 Helper: Database connection
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
    console.log("🔎 Checking RekeningNummer:", value);
    const db = await getConnection();
    try {
        const [rows] = await db.execute("SELECT * FROM Kaart WHERE RekeningNummer = ?", [value]);
        console.log("✅ Lookup result:", rows);
        return rows.length > 0;
    } finally {
        await db.end();
    }
}

// 🔐 Helper: PIN verification with attempt tracking
async function verifyPinAndUpdateAttempts(rekeningnummer, pincode) {
    console.log("🔐 Verifying PIN for:", rekeningnummer);
    const db = await getConnection();
    try {
        const [userRows] = await db.execute("SELECT * FROM Kaart WHERE RekeningNummer = ?", [rekeningnummer]);
        if (userRows.length === 0) return { status: "not_found" };

        const user = userRows[0];

        if (user.attempts_left === 0) return { status: "locked" };

        if (user.Pincode === pincode) {
            // Reset attempts_left
            await db.execute("UPDATE Kaart SET attempts_left = 3 WHERE RekeningNummer = ?", [rekeningnummer]);

            // Get KlantID from Kaart
            const [kaartRows] = await db.execute(
                "SELECT KlantID FROM Kaart WHERE RekeningNummer = ?",
                [rekeningnummer]
            );

            if (kaartRows.length === 0) {
                return { status: "error", message: "KlantID niet gevonden." };
            }

            const klantID = kaartRows[0].KlantID;

            // Now get Voornaam from Klanten using KlantID
            const [nameRows] = await db.execute(
                "SELECT Voornaam FROM Klanten WHERE KlantID = ?",
                [klantID]
            );

            return {
                status: "ok",
                name: nameRows[0]?.Voornaam || "Unknown",
                pasnummer: user.pasnummer
            };
        } else {
            const left = user.attempts_left - 1;
            await db.execute("UPDATE Kaart SET attempts_left = ? WHERE RekeningNummer = ?", [left, rekeningnummer]);
            return { status: left <= 0 ? "locked" : "not_found", attempts_left: left };
        }
    } finally {
        await db.end();
    }
}

// 📡 Helper: Get user info from NOOB
async function getNoobUserInfo(iban, pin, pasnummer) {
    console.log("🌐 Requesting NOOB user info:", { iban, pasnummer });

    try {
        const { data } = await axios.post(
            `${NOOB_SERVER}/api/noob/users/getinfo?target=${encodeURIComponent(iban)}`,
            { pin, pasnummer },
            {
                headers: {
                    "NOOB-TOKEN": NOOB_TOKEN,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("✅ NOOB response:", data);
        return { status: "ok", data };
    } catch (e) {
        console.error("❌ NOOB request failed:", e.response?.data || e.message);
        return { status: "error", message: e.response?.data?.message || e.message };
    }
}



// 🩺 Health check
app.get("/api/noob/health", (req, res) => {
    res.json({ status: "OK" });
});
//Proxy Endpoint
app.post('/api/proxy/verify-pin', async (req, res) => {
    try {
        const { pin, iban, pasnummer } = req.body;
        console.log("📨 Received verify-pin request:", { pin, iban, pasnummer });

        if (!pin || !iban || !pasnummer) {
            console.warn("⚠️ Missing required fields:", { pin, iban, pasnummer });
            return res.status(400).json({ error: "Missing required fields" });
        }

        const noobResponse = await fetch("http://145.24.222.63:8080/api/noob/users/getinfo", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "NOOB-TOKEN": NOOB_TOKEN
            },
            body: JSON.stringify({ pin, iban, pasnummer })
        });

        const noobData = await noobResponse.json();
        console.log("✅ NOOB response (verify-pin):", noobData);

        res.json(noobData);
    } catch (error) {
        console.error("❌ Proxy error (verify-pin):", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
app.post('/api/proxy/withdraw', async (req, res) => {
    try {
        const { iban, pin, pasnummer, amount } = req.body;
        console.log("📨 Received withdraw request:", { iban, pin, pasnummer, amount });

        if (!iban || !pin || !pasnummer || amount === undefined) {
            console.warn("⚠️ Missing required fields:", { iban, pin, pasnummer, amount });
            return res.status(400).json({ error: "Missing required fields" });
        }

        const noobResponse = await fetch("http://145.24.222.63:8080/api/noob/users/withdraw", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "NOOB-TOKEN": NOOB_TOKEN
            },
            body: JSON.stringify({ iban, pin, pasnummer, amount })
        });

        const noobData = await noobResponse.json();
        console.log("✅ NOOB response (withdraw):", noobData);

        res.status(noobResponse.status).json(noobData);
    } catch (error) {
        console.error("❌ Proxy error (withdraw):", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// 🧠 GETINFO with PIN + Pasnummer + IBAN verification
app.post("/api/noob/users/getinfo", async (req, res) => {
    const { iban, pin, pasnummer } = req.body;
    console.log("📨 Incoming getinfo request:", { iban, pin, pasnummer });

    if (!iban || !pin || !pasnummer) {
        console.warn("⚠️ Missing iban, pin, or pasnummer");
        return res.status(400).json({ message: "Missing iban, pin, or pasnummer" });
    }

    const db = await getConnection();
    try {
        const [kaartRows] = await db.execute("SELECT * FROM Kaart WHERE RekeningNummer = ?", [iban]);
        console.log("🔍 Kaart lookup result:", kaartRows);

        if (kaartRows.length === 0) return res.status(404).json({ message: "IBAN not found" });

        const kaart = kaartRows[0];
        if (kaart.attempts_left === 0) {
            console.warn("🔒 Card locked:", iban);
            return res.status(403).json({ message: "Card is locked" });
        }

        if (kaart.Pincode !== pin || kaart.pasnummer !== pasnummer) {
            const left = kaart.attempts_left - 1;
            await db.execute("UPDATE Kaart SET attempts_left = ? WHERE RekeningNummer = ?", [left, iban]);
            console.warn("❌ Invalid credentials. Attempts left:", left);
            return res.status(401).json({ message: `Invalid credentials. Attempts left: ${left}` });
        }

        await db.execute("UPDATE Kaart SET attempts_left = 3 WHERE RekeningNummer = ?", [iban]);

        const [rekeningRows] = await db.execute("SELECT Saldo, Valuta FROM Rekening WHERE RekeningNummer = ?", [iban]);
        console.log("💰 Rekening lookup result:", rekeningRows);

        if (rekeningRows.length === 0) return res.status(404).json({ message: "Rekening not found" });

        res.json({ iban, saldo: rekeningRows[0].Saldo, valuta: rekeningRows[0].Valuta });
    } catch (err) {
        console.error("❌ /getinfo error:", err);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        await db.end();
    }
});

//WITHDRAW!
app.post("/api/noob/users/withdraw", async (req, res) => {
    const { iban, pin, pasnummer, amount } = req.body;
    console.log("📨 Incoming withdraw request:", { iban, pin, pasnummer, amount });

    if (!iban || !pin || !pasnummer || amount === undefined) {
        console.warn("⚠️ Missing iban, pin, pasnummer, or amount");
        return res.status(400).json({ message: "Missing iban, pin, pasnummer, or amount" });
    }

    if (typeof amount !== "number" || amount <= 0) {
        console.warn("⚠️ Invalid withdrawal amount:", amount);
        return res.status(400).json({ message: "Invalid withdrawal amount" });
    }

    const db = await getConnection();
    try {
        await db.beginTransaction();

        const [kaartRows] = await db.execute("SELECT * FROM Kaart WHERE RekeningNummer = ? FOR UPDATE", [iban]);
        console.log("🔍 Kaart lookup (withdraw):", kaartRows);

        if (kaartRows.length === 0) {
            await db.rollback();
            return res.status(404).json({ message: "IBAN not found" });
        }

        const kaart = kaartRows[0];
        if (kaart.attempts_left === 0) {
            await db.rollback();
            console.warn("🔒 Card locked (withdraw):", iban);
            return res.status(403).json({ message: "Card is locked" });
        }

        if (kaart.Pincode !== pin || kaart.pasnummer !== pasnummer) {
            const left = kaart.attempts_left - 1;
            await db.execute("UPDATE Kaart SET attempts_left = ? WHERE RekeningNummer = ?", [left, iban]);
            await db.commit();
            console.warn("❌ Invalid credentials (withdraw). Attempts left:", left);
            return res.status(401).json({ message: `Invalid credentials. Attempts left: ${left}` });
        }

        if (kaart.attempts_left !== 3) {
            await db.execute("UPDATE Kaart SET attempts_left = 3 WHERE RekeningNummer = ?", [iban]);
        }

        const [rekeningRows] = await db.execute("SELECT Saldo FROM Rekening WHERE RekeningNummer = ? FOR UPDATE", [iban]);
        console.log("💰 Rekening row (withdraw):", rekeningRows);

        if (rekeningRows.length === 0) {
            await db.rollback();
            return res.status(404).json({ message: "Rekening not found" });
        }

        const saldo = parseFloat(rekeningRows[0].Saldo);
        if (saldo < amount) {
            await db.rollback();
            console.warn("❌ Insufficient funds:", { saldo, amount });
            return res.status(400).json({ message: "Insufficient funds" });
        }

        const newSaldo = saldo - amount;
        await db.execute("UPDATE Rekening SET Saldo = ? WHERE RekeningNummer = ?", [newSaldo, iban]);

        await db.execute("INSERT INTO Transactie (KlantID, Bedrag, Type) VALUES (?, ?, 'Withdrawal')", [kaart.KlantID, amount]);
        await db.commit();

        console.log("✅ Withdrawal successful:", { iban, amount, newSaldo });
        res.json({ iban, message: "Withdrawal successful" });
    } catch (err) {
        await db.rollback();
        console.error("❌ /withdraw error:", err);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        await db.end();
    }
});


// 🌐 Proxying other NOOB API requests
app.all("/api/noob/*", async (req, res, next) => {
    if (req.path === "/api/noob/health") return next();

    console.log(`🔁 Proxying ${method.toUpperCase()} to NOOB: ${url}`);
    const token = req.header("NOOB-TOKEN");
    const iban = req.body?.iban || req.query.iban || req.query.target;

    if (!iban || !token) {
        return res.status(400).json({ message: "Missing NOOB-TOKEN header or IBAN." });
    }

    const country = iban.slice(0, 2);
    const bank = iban.slice(4, 8);
    const target = `${country}-${bank}`;

    const bankServer = await resolveBankServer(target);
    if (!bankServer) return res.status(404).json({ message: "Bank server not found for IBAN." });

    try {
        const response = await axios({
            method: req.method,
            url: `${bankServer}/api/${req.params[0]}`,
            headers: {
                ...req.headers,
                "NOOB-TOKEN": token,
                "NOOB-ORIGIN-COUNTRY": country,
                "NOOB-ORIGIN-BANK": bank,
                "Content-Type": "application/json"
            },
            params: req.query,
            data: req.body
        });
        res.status(response.status).json(response.data);
    } catch (err) {
        console.error("Proxy error:", err.response?.data || err.message);
        res.status(500).json({ message: "Proxy request failed." });
    }
});

async function resolveBankServer(target) {
    if (target === "NL-MASB") return "http://localhost:8080";
    return null;
}

const server = app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});

// 🔌 WebSocket Setup
const wss = new WebSocket.Server({ server });
const clients = new Map();

wss.on("connection", (ws) => {
    console.log("🔌 New WebSocket connection");
    ws.on("message", async (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            console.log("📩 WebSocket message received:", data);
            const role = clients.get(ws);

            if (data.type === "identity") {
                clients.set(ws, data.role);
                console.log("🔑 Identity set:", data.role);
                if (data.role === "web") {
                    for (const client of wss.clients) {
                        if (clients.get(client) === "esp" && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ type: "scan" }));
                            console.log("📡 Sent scan request to ESP");
                        }
                    }
                }
                return;
            }


            if (data.type === "rfid" && role === "esp") {
                console.log("🔍 RFID received:", data);
                const exists = await lookupRekeningnummer(data.rekeningnummer);
                for (const client of wss.clients) {
                    if (clients.get(client) === "web" && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: "verified",
                            status: exists ? "ok" : "not_found",
                            rekeningnummer: data.rekeningnummer,
                            pasnummer: data.pasnummer
                        }));
                        console.log("📤 Sent RFID verification to web");
                    }
                }
            }

            if (data.type === "pin" && role === "pincode") {
                console.log("🔐 PIN entry:", data);
                const result = await verifyPinAndUpdateAttempts(data.rekeningnummer, data.value);
                if (result.status === "ok") {
                    const noob = await getNoobUserInfo(data.rekeningnummer, data.value, result.pasnummer);
                    ws.send(JSON.stringify({
                        type: "verified",
                        ...(noob.status === "ok" ? {
                            status: "ok",
                            name: result.name,
                            iban: noob.data.iban,
                            saldo: noob.data.saldo,
                            valuta: noob.data.valuta
                        } : {
                            status: "error",
                            message: noob.message
                        })
                    }));
                    console.log("✅ PIN verified and NOOB info sent");
                } else {
                    ws.send(JSON.stringify({
                        type: "verified",
                        status: result.status,
                        message: result.message || `Remaining attempts: ${result.attempts_left}`
                    }));
                    console.log("⚠️ PIN verification failed");
                }
            }

            if (data.type === "keypad") {
                console.log("⌨️ Keypad input:", data);
                for (const client of wss.clients) {
                    const clientRole = clients.get(client);
                    if (
                        ["pincode", "bedraginvoer","bevestigen"].includes(clientRole) &&
                        client.readyState === WebSocket.OPEN
                    ) {
                        client.send(JSON.stringify({ type: "keypad", value: data.value }));
                        console.log(`➡️ Forwarded keypad to ${clientRole}`);
                    }
                }
            }


            if (data.type === "dispense") {
                console.log("💸 Dispense command:", data);
                for (const client of wss.clients) {
                    if (clients.get(client) === "esp" && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                }
            }
        } catch (err) {
            console.error("WebSocket error:", err);
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
        console.log("🔌 Client disconnected");
    });
});
