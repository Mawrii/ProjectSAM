document.addEventListener('DOMContentLoaded', function () {
    // Retrieve rekeningnummer from localStorage
    const rekeningnummer = localStorage.getItem('rekeningNummer');
    if (!rekeningnummer) {
        alert("No rekeningnummer found. Please scan your card first.");
        window.location.href = "index.html"; // Redirect if no rekeningnummer found
    } else {
        console.log("Rekeningnummer retrieved:", rekeningnummer);
    }

    const pincodeInputs = document.querySelectorAll('.pincode-block');
    const ws = new WebSocket("ws://145.24.222.63:8001");

    ws.onopen = () => {
        console.log("WebSocket connected.");
        ws.send(JSON.stringify({ type: "identity", role: "pincode" }));
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.type === "verified") {
                if (data.status === "ok") {
                    console.log("User's name:", data.name);
                    alert(`Welcome, ${data.name}!`);
                    window.location.href = "geldkeuze.html"; // Redirect if PIN is correct
                } else if (data.status === "not_found") {
                    alert(`Incorrect PIN! ${data.message}`);
                } else if (data.status === "locked") {
                    alert(data.message); // Account is locked
                }
            }

            if (data.message) {
                alert(data.message); // Handle other messages like account lock
            }

        } catch (err) {
            console.error("Invalid JSON received:", event.data);
        }
    };

    ws.onerror = (err) => {
        document.getElementById("status").textContent = "Verbindingsfout met WebSocket-server.";
        console.error("WebSocket error:", err);
    };

    pincodeInputs.forEach((input, index) => {
        input.addEventListener('input', function () {
            if (this.value.length === 1 && index < pincodeInputs.length - 1) {
                pincodeInputs[index + 1].focus(); // Focus next input
            }
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && this.value.length === 0 && index > 0) {
                pincodeInputs[index - 1].focus(); // Focus previous input
            }
        });
    });

    // Submit PIN when ready
    document.querySelector('.volgende').addEventListener('click', () => {
        const pincode = Array.from(pincodeInputs).map(input => input.value).join("");

        if (pincode.length === 4) {
            console.log("Submitting Pincode:", pincode);

            // Send the PIN to the server for verification
            const pinData = {
                type: "pin",
                rekeningnummer: rekeningnummer, // Include rekeningnummer with the PIN
                value: pincode
            };

            ws.send(JSON.stringify(pinData));
        } else {
            alert("Please complete the pincode.");
        }
    });
});
