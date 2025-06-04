/*
1 = Snel pinnen €70
2 = Zelf bedrag kiezen
A/C = Annuleren
*/document.addEventListener("DOMContentLoaded", () => {
    function bevestig70() {
  window.location.href = "bevestigen.html?bedrag=70";
}
  const ws = new WebSocket(`ws://${window.location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "identity", role: "geldkeuze" }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "keypad") {
        const key = data.value;
        console.log(" Keypad Key Received:", key);

        if (key === "1") {
          // Snel pinnen €70
          window.location.href = "bevestigen.html?bedrag=70";
          return;
        }

        if (key === "2") {
          // Zelf bedrag kiezen
          window.location.href = "bedraginvoer.html";
          return;
        }

        if (["A", "*"].includes(key)) {
          // Annuleren
          window.location.href = "index.html";
          return;
        }
      }

      if (data.message) {
        console.log("ℹMessage:", data.message);
      }

    } catch (err) {
      console.error("Invalid JSON received:", event.data);
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };
});
