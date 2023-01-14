import axios from 'axios';

const darkModeButton = document.getElementById('dark-mode-btn');
const darkModeIcon = document.getElementById('dark-mode-icon');

function toggleDarkModeIcon() {
    if (darkModeIcon.getAttribute('src') === 'images/moon.png') {
        darkModeIcon.setAttribute('src', 'images/sun.png');
    } else {
        darkModeIcon.setAttribute('src', 'images/moon.png');
    }
}

darkModeButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    toggleDarkModeIcon();
});

function updatePrices() {
    axios.get('/scraper.py')
    .then(response => {
        var prices = response.data;
        // update the HTML elements with the new prices
        document.getElementById("fine-gold-gram").innerHTML = "Fine Gold (per 10 grm): " + prices.fine_gold_gram;
        document.getElementById("tejabi-gold-gram").innerHTML = "Tejabi Gold (per 10 grm): " + prices.tejabi_gold_gram;
        document.getElementById("silver-gram").innerHTML = "Silver (per 10 grm): " + prices.silver_gram;
        document.getElementById("fine-gold-tola").innerHTML = "Fine Gold (per 1 tola): " + prices.fine_gold_tola;
        document.getElementById("tejabi-gold-tola").innerHTML = "Tejabi Gold (per 1 tola): " + prices.tejabi_gold_tola;
        document.getElementById.innerHTML = "Silver (per 1 tola): " + prices.silver_tola;
    })
    .catch(error => {
        console.log(error);
    });
}

updatePrices();
setInterval(updatePrices, 3600000);