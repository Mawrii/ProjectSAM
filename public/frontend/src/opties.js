document.addEventListener('DOMContentLoaded', function() {
    // Retrieve the stored data from local storage
    var accountInfo = localStorage.getItem('accountInfo');

    if (accountInfo) {
        // Parse the stored JSON data
        var data = JSON.parse(accountInfo);

        // Display the naam and amount
        document.getElementById('naam').textContent = `Naam: ${data.klanten.naam}`;
        document.getElementById('amount').textContent = `Amount: ${data.kaarten.amount}`;
    } else {
        
        alert("No account information found. Please try again.");
    }
});
