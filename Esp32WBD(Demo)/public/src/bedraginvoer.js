    document.addEventListener('DOMContentLoaded', () => {
        const bedragInput = document.getElementById("bedrag");
        const notice = document.getElementById("redNotice");
        const button = document.querySelector(".volgende");
        const ws = new WebSocket("ws://145.24.222.63:8080");

       
        bedragInput.focus();

     
        ws.onopen = () => {
            console.log("WebSocket connected.");
            ws.send(JSON.stringify({ type: "identity", role: "bedraginvoer" }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === "keypad") {
                    const key = data.value;
                    console.log("Keypad Key Received:", key);

                    if (key === "A") {
                        window.location.href = "index.html";
                    } else if (key === "B") {
                        window.location.href = "geldkeuze.html";
                    } else if (key === "C") {
                        bedragInput.value = bedragInput.value.slice(0, -1);
                    } else if (key === "D") {
                        bevestigBedrag();
                    } else if (key === "*") {
        window.location.href = "index.html"; // Navigate after confirmation
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

    if (isNaN(bedrag)) {
        notice.textContent = "Voer alstublieft een geldig bedrag in.";
        notice.style.display = "block";
        return;
    }

    if (bedrag < 20) {
        notice.textContent = "U moet minimaal €20 opnemen.";
        notice.style.display = "block";
        return;
    }

    if (bedrag > 200) {
        notice.textContent = "U kunt maximaal €200 per keer opnemen.";
        notice.style.display = "block";
        return;
    }

    if (bedrag % 5 !== 0) {
        notice.textContent = "Alleen bedragen die deelbaar zijn door 5 zijn toegestaan.";
        notice.style.display = "block";
        return;
    }

    notice.style.display = "none";
    console.log(`Bevestigd bedrag: €${bedrag}`);
    window.location.href = `bevestigen.html?bedrag=${bedrag}`;
}

    }); 
