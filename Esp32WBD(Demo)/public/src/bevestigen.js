const ws = new WebSocket('ws://145.24.222.63:8080/');
 
ws.onopen = () => {
    console.log('✅ WebSocket connected');
    ws.send(JSON.stringify({ type: "identity", role: "bevestigen" }));
};
 
ws.onmessage = (e) => {
    console.log('📨 Server:', e.data);
    const data = JSON.parse(e.data);
 
    if (data.type === "dispense_done") {
        window.location.href = "bon.html";
    } else if (data.type === "error") {
        alert('❌ Fout: ' + data.message);
    } else if (data.type === "keypad") {
        handleKeypadInput(data.value);
    }
};
 
function handleKeypadInput(key) {
    console.log("⌨️ Keypad received:", key);
    if (key === "C") {
        window.location.href = "geldkeuze.html";
    } else if (key === "D") {
        bevestig();
        window.location.href = "bon.html"; // Navigate after confirmation
    }
        else if (key === "*") {
        window.location.href = "index.html"; // Navigate after confirmation
    }
}
 
// Get bedrag from query parameter
const bedrag = parseFloat(new URLSearchParams(window.location.search).get('bedrag'));
    localStorage.setItem("bedrag", bedrag); 
if (bedrag) {
    document.getElementById("bedragTekst").textContent = `Te pinnen bedrag: €${bedrag}`;
}
 
async function bevestig() {
    if (isNaN(bedrag) || bedrag < 20 || bedrag > 200 || bedrag % 5 !== 0) {
        alert("Ongeldig bedrag.");
        return;
    }
 
    const iban = localStorage.getItem('rekeningNummer');
    const pin = localStorage.getItem('pin');
    const pasnummer = localStorage.getItem('pasnummer');
 
    if (!iban || !pin || !pasnummer) {
        alert("Ontbrekende accountgegevens. Log opnieuw in.");
        window.location.href = "index.html";
        return;
    }
 
    try {
        const response = await fetch('/api/noob/users/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ iban, pin, pasnummer, amount: bedrag })
        });
 
        const result = await response.json();
 
        if (!response.ok) {
            alert(`❌ Fout: ${result.message || "Onbekende fout"}`);
            return;
        }
 
        if (result.message === "Withdrawal successful") {
            console.log('✅ Opname gelukt:', result);
 
            // Send full bedrag, not just rotations
            ws.send(JSON.stringify({ type: 'dispense', rotations: bedrag }));
        } else {
            alert(`⚠️ Onverwachte response: ${JSON.stringify(result)}`);
        }
    } catch (err) {
        console.error("❌ Fout bij communicatie met server:", err);
        alert("Er is een fout opgetreden, probeer het opnieuw.");
    }
}