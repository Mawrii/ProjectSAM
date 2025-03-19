const iban = localStorage.getItem('iban');
const uid = localStorage.getItem('uid');

const socket = new WebSocket('ws://145.24.223.208:8091');
socket.addEventListener('open', function (event) {
  console.log('Connected to WebSocket server');
});

socket.addEventListener('message', function (event) {
  console.log('Message from server: ', event.data);
  handleNumpadInput(event.data);
});

const inputs = document.querySelectorAll('.pin-code input');

function handleNumpadInput(key) {
  if (key === 'A') {
    handleSubmit();
  } else if (key === 'B') {
    for (let i = inputs.length - 1; i >= 0; i--) {
      if (inputs[i].value) {
        inputs[i].value = '';
        break;
      }
    }
  } else if (key === 'C') {
    window.location.href = 'index.html';
  } else if (!isNaN(key)) {
    for (let input of inputs) {
      if (!input.value) {
        input.value = key;
        break;
      }
    }
  }
}

function handleSubmit() {
  let enteredPin = '';
  inputs.forEach(input => {
    enteredPin += input.value;
  });

  fetch('http://145.24.223.208:8080/api/accountinfo?target=' + iban, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      uid: uid,
      pincode: enteredPin,
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else if (response.status === 401) {
      return response.json().then(data => { throw new Error(`Unauthorized: ${data.error}, Attempts remaining: ${data.attempts_remaining}`); });
    } else if (response.status === 403) {
      throw new Error("Pas Geblokkeerd");
    } else if (response.status === 404) {
      throw new Error("Bestaat IBAN? Bestaat Bank?");
    } else if (response.status === 400) {
      throw new Error("Bad Request");
    } else {
      throw new Error("Something went wrong");
    }
  })
  .then(data => {
    console.log("Success:", data);
    localStorage.setItem('accountInfo', JSON.stringify(data));
    window.location.href = "opties.html";
  })
  .catch(error => {
    console.error("Error:", error);
    alert(error.message);
    inputs.forEach(input => input.value = '');
    inputs[0].focus();
  });
}

pinContainer.addEventListener('keyup', function (event) {
  const target = event.target;
  const maxLength = parseInt(target.getAttribute("maxlength"), 10);
  const myLength = target.value.length;

  if (myLength >= maxLength) {
    const next = target.nextElementSibling;
    if (next && next.tagName.toLowerCase() === "input") {
      next.focus();
    }
  }

  if (myLength === 0) {
    const prev = target.previousElementSibling;
    if (prev && prev.tagName.toLowerCase() === "input") {
      prev.focus();
    }
  }
});

pinContainer.addEventListener('keydown', function (event) {
  if (event.key === "A" || event.key === "a") {
    handleSubmit();
  }
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    handleSubmit();
  }
});