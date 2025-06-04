// app.js
require("dotenv").config();
const express = require("express");
const DatabaseService = require("./public/src/server/database.service");
const apiRouter = require("./public/src/server/endpoints");
const SocketService = require("./public/src/server/websocket.service");
const cors = require("cors");
const path = require("path");
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // Serve static files
app.use("/api", apiRouter);

// Test DB connection on startup
DatabaseService.testConnection()
    .then(() => console.log("✅ DB connected"))
    .catch(err => console.error("❌ DB connection failed:", err));

const server = app.listen(process.env.PORT || 8080, () => {
    console.log(`🚀 Server running on port ${server.address().port}`);
});

new SocketService(server); // Start WebSocket service