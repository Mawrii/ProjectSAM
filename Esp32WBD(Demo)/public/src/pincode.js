document.addEventListener('DOMContentLoaded', function () {
    const rekeningnummer = localStorage.getItem('rekeningNummer');
    const isLocalIban = /^TD\d{2}MASB/.test(rekeningnummer);
    console.log("Loaded rekeningnummer:", rekeningnummer);
    console.log("Is local IBAN:", isLocalIban);
    const pincodeInputs = document.querySelectorAll('.pincode-block');
    const ws = new WebSocket("ws://145.24.222.63:8080");
    let currentIndex = 0;

    function showMessage(msg, isError = true) {
        const box = document.getElementById("message-box");
        box.textContent = msg;
        box.classList.add("show");
        box.style.backgroundColor = isError ? "#f8d7da" : "#d4edda";
        box.style.color = isError ? "#721c24" : "#155724";
        box.style.borderColor = isError ? "#f5c6cb" : "#c3e6cb";

        setTimeout(() => {
            box.classList.remove("show");
        }, 4000);
    }

    ws.onopen = () => {
        console.log("WebSocket connected.");
        ws.send(JSON.stringify({ type: "identity", role: "pincode" }));
    };

    ws.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);

            // Add this to get localStorage values fresh on every message
            const rekeningnummer = localStorage.getItem('rekeningNummer');
            const pasnummer = localStorage.getItem('pasnummer');

            if (data.type === "verified") {
                if (data.status === "ok") {
                    showMessage("✅ PIN correct. Ophalen gebruikersgegevens...", false);

                    const pin = Array.from(pincodeInputs).map(input => input.value).join("");

                    try {
                        const endpoint = "http://145.24.222.63:8080/api/noob/users/getinfo";

                        const response = await fetch(endpoint, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                pin: pin,
                                iban: rekeningnummer,
                            })
                        });

                        if (response.ok) {
                            const userInfo = await response.json();
                            localStorage.setItem("pin", pin);
                            console.log("User info:", userInfo);
                            localStorage.setItem("userInfo", JSON.stringify(userInfo));

                            setTimeout(() => {
                                window.location.href = "geldkeuze.html";
                            }, 1500);
                        } else {
                            const contentType = response.headers.get("content-type");
                            let errorData = {};

                            if (contentType && contentType.includes("application/json")) {
                                errorData = await response.json();
                            } else {
                                errorData.message = await response.text();
                            }

                            showMessage("Fout bij ophalen gebruikersgegevens: " + errorData.message);
                        }
                    } catch (err) {
                        console.error("Fetch error:", err);
                        showMessage("Fout bij ophalen gebruikersgegevens.");
                    }

                } else if (data.status === "not_found") {
                    showMessage(`❌ Incorrect PIN! ${data.message}`);
                } else if (data.status === "locked") {
                    showMessage(`🔒 ${data.message}`);
                    // Optionally disable inputs if locked
                    pincodeInputs.forEach(input => input.disabled = true);
                }
            }


            if (data.type === "keypad") {
                const key = data.value;
                console.log("🔢 Keypad Key Received:", key);

                if (["A", "*"].includes(key)) {
                    if (key === "*") {
                        window.location.href = "index.html";
                    }
                    return;
                }

                if (key === "D") {
                    submitPIN();
                    return;
                }

                if (key === "C") {
                    if (currentIndex > 0) {
                        currentIndex--;
                        pincodeInputs[currentIndex].value = "";
                        pincodeInputs[currentIndex].focus();
                    }
                    return;
                }

                if (!isNaN(key) && currentIndex < pincodeInputs.length) {
                    pincodeInputs[currentIndex].value = key;
                    currentIndex++;
                    if (currentIndex < pincodeInputs.length) {
                        pincodeInputs[currentIndex].focus();
                    }
                }
            }

            if (data.message) {
                showMessage(data.message);
            }

        } catch (err) {
            console.error("Invalid JSON received:", event.data);
        }
    };

    ws.onerror = (err) => {
        document.getElementById("status").textContent = "Verbindingsfout met WebSocket-server.";
        console.error("WebSocket error:", err);
        showMessage("Verbindingsfout met WebSocket-server.");
    };

    if (pincodeInputs.length > 0) {
        pincodeInputs[0].focus();
    }

    pincodeInputs.forEach((input, index) => {
        input.addEventListener('input', function () {
            if (this.value.length === 1 && index < pincodeInputs.length - 1) {
                pincodeInputs[index + 1].focus();
                currentIndex = index + 1;
            }
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && this.value.length === 0 && index > 0) {
                pincodeInputs[index - 1].focus();
                currentIndex = index - 1;
            }
            if (e.key === 'Enter') {
                document.querySelector('.volgende').click();
            }
        });
    });

    document.querySelector('.volgende').addEventListener('click', submitPIN);

    function submitPIN() {
        const pincode = Array.from(pincodeInputs).map(input => input.value).join("");

        if (pincode.length === 4) {
            console.log("📨 Sending PIN:", pincode);
            const pinData = {
                type: "pin",
                rekeningnummer: rekeningnummer,
                value: pincode
            };
            ws.send(JSON.stringify(pinData));
        } else {
            showMessage("Voer hele pincode in!");
        }
    }
});
