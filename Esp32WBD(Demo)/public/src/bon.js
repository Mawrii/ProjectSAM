const ws = new WebSocket('ws://145.24.222.63:8080/');

ws.onopen = () => {
    console.log('WebSocket connected');
    ws.send(JSON.stringify({ type: "identity", role: "bon" }));
};

ws.onmessage = (e) => {
    console.log(' Server:', e.data);
    const data = JSON.parse(e.data);

 if (data.type === "error") {
        alert('❌ Fout: ' + data.message);
    } else if (data.type === "keypad") {
        handleKeypadInput(data.value);
    }
};

ws.onclose = () => {
    console.log('WebSocket is closed now.');
};

ws.onerror = (error) => {
    console.log('WebSocket Error: ', error);
};

function handleKeypadInput(key) {
    console.log("⌨️ Keypad received:", key);

    if (key === "C") {
        window.location.href = "totziens.html"; // Navigate back
    } else if (key === "D") {
        verzendOpdracht(); // Trigger print
    }
}

function verzendOpdracht() {
    const bedrag = localStorage.getItem("bedrag");

    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'bonPrint',
            data: { bedrag }
        }));

        console.log(' Printopdracht verzonden naar server.');
        window.location.href = "totziens.html"; // Navigate back

    } else {
        console.log('WebSocket is niet verbonden.');
    }
}
