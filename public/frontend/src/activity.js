// inactivityTimer.js

let inactivityTime = function () {
    let timer;

    function resetTimer() {
        clearTimeout(timer);
        if(timer == 30000){
            alert("Ben jij er nog?");
        }
        timer = setTimeout(logout, 60000); // 1 minute (60000 ms) of inactivity
    }

    function logout() {
        window.location.href = 'index.html';
    }

    window.onload = resetTimer;
    document.onmousemove = resetTimer;
    document.onkeypress = resetTimer;
    document.ontouchstart = resetTimer; // For mobile devices
    document.onclick = resetTimer; // Reset on mouse click
    document.onscroll = resetTimer; // Reset on scroll
};

inactivityTime();
