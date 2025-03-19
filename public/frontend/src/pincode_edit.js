var pinContainer = document.querySelector(".pin-code");

pinContainer.addEventListener('input', function (event) {
    var target = event.target;
    var maxLength = parseInt(target.getAttribute("maxlength"), 10);
    var myLength = target.value.length;

    if (myLength >= maxLength) {
        var next = target.nextElementSibling;
        if (next && next.tagName.toLowerCase() === "input") {
            next.focus();
        }
    }

    if (myLength === 0) {
        var prev = target.previousElementSibling;
        if (prev && prev.tagName.toLowerCase() === "input") {
            prev.focus();    
        }
    }
});

pinContainer.addEventListener('keydown', function (event) {
    if (event.key === "Enter") {
        var enteredPin = "";
        var inputs = document.querySelectorAll('.pin-code input');
        inputs.forEach(function(input) {
            enteredPin += input.value;
        });

        // Fetch request to send the pin code to the server
        fetch('http://145.24.223.208:8080/api/pincode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rekeningnummer: 'ZW00MASB1234561234', // Replace with actual rekeningnummer
                pincode: enteredPin
            })
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to change pin code');
            }
        })
        .then(data => {
            // Handle the response from the server
            if (data.success) {
                console.log("Pin code changed successfully:", enteredPin);
                alert("Pin code changed successfully.");
            } else {
                console.log("Pin code changed successfully:", enteredPin);
                alert("Pin code changed successfully.");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Something went wrong. Please try again later.');
        });

        // Clear the input fields
        inputs.forEach(function(input) {
            input.value = '';
        });
        // Focus back on the first input field
        inputs[0].focus();
    }
});
