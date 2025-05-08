const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
const port = 8001;

app.use(cors());
app.use(express.static("public"));

const server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });
const clients = new Map(); // ws -> role

// MySQL Lookup Function to check rekeningnummer (RFID)
async function lookupRekeningnummer(value) {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: "127.0.0.1",
            user: "root",
            password: "User@1234",
            database: "SAM",
            port: 3306
        });
        console.log("✅ Connected to MySQL Database.");

        console.log(`🔍 Looking up RekeningNummer: ${value}`);
        const [rows] = await connection.execute(
            "SELECT * FROM Kaart WHERE RekeningNummer = ?",
            [value]
        );

        console.log(`➡️ Result: ${rows.length > 0 ? "FOUND" : "NOT FOUND"}`);
        return rows.length > 0;

    } catch (err) {
        console.error("❌ MySQL error:", err);
        return false;
    } finally {
        if (connection) await connection.end();
    }
}

// MySQL Lookup Function to verify PIN and update attempts
async function verifyPinAndUpdateAttempts(rekeningnummer, pincode) {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: "127.0.0.1",
            user: "root",
            password: "User@1234",
            database: "SAM",
            port: 3306
        });
        console.log("✅ Connected to MySQL Database.");

        // Check if rekeningnummer exists and retrieve the attempts_left
        const [userRows] = await connection.execute(
            "SELECT * FROM Kaart WHERE RekeningNummer = ?",
            [rekeningnummer]
        );

        if (userRows.length === 0) {
            return { status: "not_found", message: "Rekeningnummer not found." };
        }

        const user = userRows[0];

        // Check if the account is locked (attempts_left == 0)
        if (user.attempts_left === 0) {
            return { status: "locked", message: "Account is locked due to too many failed attempts." };
        }

        // Check if the pincode matches
        if (user.Pincode === pincode) {
            // If correct, reset attempts_left to 3
            await connection.execute(
                "UPDATE Kaart SET attempts_left = 3 WHERE RekeningNummer = ?",
                [rekeningnummer]
            );

            // Fetch the user's name from the Klanten table
            const [nameRows] = await connection.execute(
                "SELECT Voornaam FROM Klanten WHERE RekeningNummer = ?",
                [rekeningnummer]
            );
            const userName = nameRows.length > 0 ? nameRows[0].Voornaam : "Unknown User";

            return {
                status: "ok",
                message: "PIN verified successfully.",
                name: userName
            };
        } else {
            // Decrease attempts_left if the PIN is incorrect
            const newAttemptsLeft = user.attempts_left - 1;
            await connection.execute(
                "UPDATE Kaart SET attempts_left = ? WHERE RekeningNummer = ?",
                [newAttemptsLeft, rekeningnummer]
            );

            if (newAttemptsLeft <= 0) {
                return { status: "locked", message: "Account is locked due to too many failed attempts." };
            }

            return {
                status: "not_found",
                message: `Incorrect PIN. Attempts remaining: ${newAttemptsLeft}`
            };
        }

    } catch (err) {
        console.error("❌ MySQL error:", err);
        return { status: "error", message: "An error occurred while verifying the PIN." };
    } finally {
        if (connection) await connection.end();
    }
}

wss.on("connection", (ws) => {
    console.log("New WebSocket connection");

    ws.on("message", async (message) => {
        const text = message.toString();
        console.log("Received Message:", text);

        let data;
        try {
            data = JSON.parse(text);
        } catch (error) {
            console.error("Invalid JSON received:", text);
            return;
        }

        if (data.type === "identity") {
            clients.set(ws, data.role);
            console.log(`Client identified as: ${data.role}`);

            if (data.role === "web") {
                wss.clients.forEach(client => {
                    if (clients.get(client) === "esp" && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: "scan" }));
                    }
                });
            }
            return;
        }

        const role = clients.get(ws);

        // RFID handling (separate from PIN verification)
        if (data.type === "rfid" && role === "esp") {
            const rekeningnummer = data.value;

            // Send verification status (e.g., checking if rekeningnummer exists)
            const exists = await lookupRekeningnummer(rekeningnummer);
            console.log(`Rekeningnummer ${rekeningnummer} found: ${exists}`);

            // Send response back to the web client
            wss.clients.forEach(client => {
                if (clients.get(client) === "web" && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: "verified",
                        status: exists ? "ok" : "not_found",
                        rekeningnummer: rekeningnummer
                    }));
                }
            });
        }

        // PIN handling (separate from RFID scan)
        if (data.type === "pin" && role === "pincode") {
            const { rekeningnummer, value: pincode } = data;
            console.log(`🔍 Verifying PIN for RekeningNummer: ${rekeningnummer} and Pincode: ${pincode}`);

            // Verify PIN and update attempts in the database
            const verificationResult = await verifyPinAndUpdateAttempts(rekeningnummer, pincode);

            if (verificationResult.status === "ok") {
                // Send user name and allow next step
                ws.send(JSON.stringify({
                    type: "verified",
                    status: "ok",
                    name: verificationResult.name
                }));
            } else {
                // Send the error message (incorrect PIN or locked account)
                ws.send(JSON.stringify({
                    type: "verified",
                    status: verificationResult.status,
                    message: verificationResult.message
                }));
            }
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
        console.log("Client disconnected");
    });
});
