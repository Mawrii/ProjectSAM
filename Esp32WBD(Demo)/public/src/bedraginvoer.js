    document.addEventListener('DOMContentLoaded', () => {
        const rekeningnummer = localStorage.getItem('rekeningNummer');
       /*
        if (!rekeningnummer) {
            alert("No rekeningnummer found. Please scan your card first.");
            window.location.href = "index.html";
            return;
        } else {
            console.log("Rekeningnummer retrieved:", rekeningnummer);
        } */

        const bedragInput = document.getElementById("bedrag");
        const notice = document.getElementById("redNotice");
        const button = document.querySelector(".volgende");
        const ws = new WebSocket("ws://145.24.222.63:8080");

        // Focus input on load
        bedragInput.focus();

        // WebSocket setup
        ws.onopen = () => {
            console.log("WebSocket connected.");
            ws.send(JSON.stringify({ type: "identity", role: "bedraginvoer" }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === "keypad") {
                    const key = data.value;
                    console.log("🔢 Keypad Key Received:", key);

                    if (key === "A") {
                        window.location.href = "index.html";
                    } else if (key === "B") {
                        window.location.href = "geldkeuze.html";
                    } else if (key === "C") {
                        bedragInput.value = bedragInput.value.slice(0, -1);
                    } else if (key === "D") {
                        bevestigBedrag();
                    } else if (!isNaN(key)) {
                        console.log("Adding digit to input:", key);
                        bedragInput.value += key;
                    }
                }

                if (data.message) {
                    alert(data.message);
                }

            } catch (error) {
                console.error("Invalid JSON received:", event.data);
            }
        };

        ws.onerror = (err) => {
            document.getElementById("status").textContent = "Verbindingsfout met WebSocket-server.";
            console.error("WebSocket error:", err);
        };

        button.addEventListener("click", bevestigBedrag);

        function bevestigBedrag() {
            const bedrag = parseFloat(bedragInput.value);
            if (isNaN(bedrag) || bedrag <= 0) {
                notice.textContent = "Voer alstublieft een geldig bedrag in.";
                notice.style.display = "block";
                return;
            }

            if (bedrag > 100) {
                notice.textContent = "U heeft geen genoeg saldo.";
                notice.style.display = "block";
                return;
            }

            notice.style.display = "none";
            console.log(`✅ Bevestigd bedrag: €${bedrag}`);
            window.location.href = `bevestigen.html?bedrag=${bedrag}`;
        }
    }); 
