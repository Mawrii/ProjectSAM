const ws = new WebSocket("ws://145.24.222.63:8001");

ws.onopen = () => {
    console.log("WebSocket connected.");
    ws.send(JSON.stringify({ type: "identity", role: "web" }));
    ws
};

ws.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        
        // Check if the server has validated the RFID and provides a rekeningnummer
        if (data.type === "verified") {
            if (data.status === "ok") {
                // Save rekeningnummer to localStorage
                localStorage.setItem("rekeningNummer", data.rekeningnummer);
                console.log("Rekeningnummer saved to localStorage:", data.rekeningnummer);
                window.location.href = "pincode.html";  // Redirect to the pincode page
            } else {
                // If not found, show an error
                alert("Ongeldige bankpas!");
            }
        }
    } catch (err) {
        console.error("Invalid JSON ontvangen:", event.data);
    }
};

ws.onerror = (err) => {
    document.getElementById("status").textContent = "Verbindingsfout met WebSocket-server.";
    console.error("WebSocket error:", err);
};
