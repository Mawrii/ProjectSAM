const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const port = 8001;

app.use(cors());
app.use(express.static("public"));

const server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    console.log("New WebSocket connection");

    ws.on("message", (message) => {
        console.log("Received:", message);
        let data;

        try {
            data = JSON.parse(message);
        } catch (error) {
            console.error("Invalid JSON received:", message);
            return;
        }

        // Ensure all outgoing messages are JSON
        if (data.type === "rfid") {
            const response = JSON.stringify({ type: "rfid", value: data.value });
            ws.send(response);
        } else if (data.type === "keypad" && data.page === "withdraw") {
            let amount = parseInt(data.value);
            let responseMessage;

            if (!isNaN(amount) && amount > 100) {
                responseMessage = "Transaction denied: Cannot withdraw more than €100!";
            } else if (!isNaN(amount)) {
                responseMessage = `Withdrawal of €${amount} approved!`;
            } else {
                responseMessage = "Invalid input!";
            }

            ws.send(JSON.stringify({ type: "withdrawResponse", value: responseMessage }));
        }

        // Broadcast messages properly
        const jsonMessage = JSON.stringify(data);
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(jsonMessage);
            }
        });
    });

    ws.on("close", () => console.log("Client disconnected"));
});
