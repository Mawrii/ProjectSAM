const ws = new WebSocket("ws://145.24.222.63:8080");

ws.onopen = () => {
  console.log("WebSocket connected");
  ws.send(JSON.stringify({ type: "identity", role: "web" }));
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    if (data.type === "verified" && data.status === "ok") {
      localStorage.setItem("rekeningNummer", data.rekeningnummer);
      localStorage.setItem("pasnummer", data.pasnummer);
      window.location.href = "pincode.html";
    }
  } catch (err) {
    console.error("Invalid JSON received:", event.data);
  }
};

ws.onerror = (err) => {
  // No UI feedback for customers here, just log
  console.error("WebSocket error:", err);
};
