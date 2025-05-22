const ws = new WebSocket('ws://145.24.222.63:8080/');

ws.onopen = () => {
    console.log('✅ WebSocket connected');
    ws.send(JSON.stringify({ type: "identity", role: "bevestigen" }));
};

ws.onmessage = (e) => {
    console.log('📨 Server:', e.data);
    const data = JSON.parse(e.data);

    if (data.type === "dispense_done") {
        // After successful dispense, redirect to receipt page
        window.location.href = "bon.html";
    } else if (data.type === "error") {
        alert('❌ Error: ' + data.message);
    } else if (data.type === "keypad") {
        handleKeypadInput(data.value);
    }
};

async function bevestig() {
    const bedrag = parseInt(new URLSearchParams(window.location.search).get('bedrag')) || 0;

    if (bedrag <= 0) {
        alert("Ongeldig bedrag.");
        return;
    }

    // Retrieve sensitive user info from localStorage or session
    const iban = localStorage.getItem('rekeningNummer');
    const pin = localStorage.getItem('pin');         // You need to store PIN securely after user input
    const pasnummer = localStorage.getItem('pasnummer');

    if (!iban || !pin || !pasnummer) {
        alert("Ontbrekende accountgegevens. Log opnieuw in.");
        window.location.href = "index.html";
        return;
    }

    try {
        // Call your proxy API to perform the withdrawal securely
        const response = await fetch('/api/proxy/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ iban, pin, pasnummer, amount: bedrag })
        });

        const result = await response.json();

        if (!response.ok) {
            alert(`❌ Fout bij opnemen: ${result.message || result.error}`);
            return;
        }

        console.log('✅ Opname gelukt:', result);

        // Calculate rotations for dispensing cash, e.g. 1 rotation per 10 euros
        const rotaties = Math.floor(bedrag / 10);

        if (rotaties > 0) {
            ws.send(JSON.stringify({ type: 'dispense', rotations: rotaties }));
        } else {
            alert("Ongeldig bedrag voor uitgifte.");
        }
    } catch (err) {
        console.error("❌ Fout bij communicatie met server:", err);
        alert("Er is een fout opgetreden, probeer het opnieuw.");
    }
}

function handleKeypadInput(key) {
    console.log("⌨️ Keypad received:", key);
    if (key === "C") {
        window.location.href = "geldkeuze.html";
    } else if (key === "D") {
        bevestig();
    }
}

// Show bedrag on page
const bedrag = new URLSearchParams(window.location.search).get('bedrag');
if (bedrag) {
    document.getElementById("bedragTekst").textContent = `Te pinnen bedrag: €${bedrag}`;
}
