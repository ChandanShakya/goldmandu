const nepaliMonths = {
  "Baisakh": 1,
  "Jestha": 2,
  "Ashad": 3,
  "Shrawan": 4,
  "Bhadra": 5,
  "Ashoj": 6,
  "Kartik": 7,
  "Mansir": 8,
  "Poush": 9,
  "Magh": 10,
  "Falgun": 11,
  "Chaitra": 12
};

const darkModeButton = document.getElementById('dark-mode-btn');
const darkModeIcon = document.getElementById('dark-mode-icon');
const dateElement = document.querySelector('.date');
const fineGoldTolaElement = document.querySelector('.fine-gold .tola');
const fineGoldGramElement = document.querySelector('.fine-gold .gram');
const tejabiGoldTolaElement = document.querySelector('.tejabi-gold .tola');
const tejabiGoldGramElement = document.querySelector('.tejabi-gold .gram');
const silverTolaElement = document.querySelector('.silver .tola');
const silverGramElement = document.querySelector('.silver .gram');

function toggleDarkModeIcon() {
    if (darkModeIcon.getAttribute('src') === 'assets/images/moon.png') {
        darkModeIcon.setAttribute('src', 'assets/images/sun.png');
    } else {
        darkModeIcon.setAttribute('src', 'assets/images/moon.png');
    }
}

darkModeButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    toggleDarkModeIcon();
});

fetch('Values.json')
    .then(response => {
        if (!response.ok) {
            // Handle HTTP errors (e.g., 404, 500)
            // This could happen if Values.json doesn't exist yet
            if (response.status === 404) {
                console.error('Values.json not found. It might not have been created yet.');
                // Return a specific structure or throw an error to be caught by .catch()
                // This ensures the UI shows "Price data not available" or similar
                return Promise.reject('Values.json not found'); 
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Check if content type is JSON before parsing
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            // Handle non-JSON responses
            console.error('Received non-JSON response from Values.json. Content-Type:', contentType);
            // This could happen if Values.json is empty or malformed before proper JSON is written
            return Promise.reject('Server did not return JSON data or file is empty/malformed.');
        }
    })
    .then(data => {
        if (Array.isArray(data) && data.length > 0) {
            const latestData = data[data.length - 1];
            // Destructure and use latestData properties
            // Ensure the keys match exactly what's in Values.json
            const { day, month, year, fine_gold_tola, fine_gold_gram, tejabi_gold_tola, tejabi_gold_gram, silver_tola, silver_gram } = latestData;
            
            dateElement.textContent = `Gold price on ${day} ${month} ${year}`;
            fineGoldTolaElement.textContent = `Tola: ${fine_gold_tola}`;
            fineGoldGramElement.textContent = `10 Grams: ${fine_gold_gram}`; 
            tejabiGoldTolaElement.textContent = `Tola: ${tejabi_gold_tola}`;
            tejabiGoldGramElement.textContent = `10 Grams: ${tejabi_gold_gram}`; 
            silverTolaElement.textContent = `Tola: ${silver_tola}`;
            silverGramElement.textContent = `10 Grams: ${silver_gram}`;

            // --- CHART GENERATION LOGIC ---
            // Ensure data is still valid for charts (it should be, based on the outer if)
            if (Array.isArray(data) && data.length > 0) {
                const labels = [];
                const fineGoldPrices = [];
                const tejabiGoldPrices = [];
                const silverPrices = [];

                data.forEach(record => {
                    // Format date for labels
                    labels.push(`${record.day} ${record.month} ${record.year}`);
                    
                    // Extract and parse prices, ensuring they are numbers
                    // Handle potential null, "0", or missing values by converting to NaN if not parseable
                    fineGoldPrices.push(parseFloat(record.fine_gold_tola) || NaN);
                    tejabiGoldPrices.push(parseFloat(record.tejabi_gold_tola) || NaN);
                    silverPrices.push(parseFloat(record.silver_tola) || NaN);
                });

                // Get canvas contexts
                const fineGoldCtx = document.getElementById('fineGoldChart')?.getContext('2d');
                const tejabiGoldCtx = document.getElementById('tejabiGoldChart')?.getContext('2d');
                const silverCtx = document.getElementById('silverChart')?.getContext('2d');

                const chartOptions = {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            beginAtZero: false,
                            title: {
                                display: true,
                                text: 'Price (NPR)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        }
                    }
                };

                if (fineGoldCtx) {
                    new Chart(fineGoldCtx, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Fine Gold (per Tola)',
                                data: fineGoldPrices,
                                borderColor: 'rgba(255, 215, 0, 1)', // Gold
                                backgroundColor: 'rgba(255, 215, 0, 0.2)',
                                tension: 0.1
                            }]
                        },
                        options: JSON.parse(JSON.stringify(chartOptions)) // Deep copy options
                    });
                } else {
                    console.error("Could not find canvas with ID fineGoldChart");
                }

                if (tejabiGoldCtx) {
                    new Chart(tejabiGoldCtx, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Tejabi Gold (per Tola)',
                                data: tejabiGoldPrices,
                                borderColor: 'rgba(218, 165, 32, 1)', // Goldenrod
                                backgroundColor: 'rgba(218, 165, 32, 0.2)',
                                tension: 0.1
                            }]
                        },
                        options: JSON.parse(JSON.stringify(chartOptions)) // Deep copy options
                    });
                } else {
                    console.error("Could not find canvas with ID tejabiGoldChart");
                }

                if (silverCtx) {
                    new Chart(silverCtx, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Silver (per Tola)',
                                data: silverPrices,
                                borderColor: 'rgba(192, 192, 192, 1)', // Silver
                                backgroundColor: 'rgba(192, 192, 192, 0.2)',
                                tension: 0.1
                            }]
                        },
                        options: JSON.parse(JSON.stringify(chartOptions)) // Deep copy options
                    });
                } else {
                    console.error("Could not find canvas with ID silverChart");
                }
            }
            // --- END OF CHART GENERATION LOGIC ---

        } else {
            // This case handles:
            // 1. Values.json was successfully parsed but was an empty array.
            // 2. Values.json was parsed but was not an array (e.g. null, or an object not an array)
            console.error('Price data is not available or is in an unexpected format (e.g. empty array, not an array). Data received:', data);
            dateElement.textContent = 'Price data not available.';
            fineGoldTolaElement.textContent = 'Tola: N/A';
            fineGoldGramElement.textContent = '10 Grams: N/A';
            tejabiGoldTolaElement.textContent = 'Tola: N/A';
            tejabiGoldGramElement.textContent = '10 Grams: N/A';
            silverTolaElement.textContent = 'Tola: N/A';
            silverGramElement.textContent = '10 Grams: N/A';
        }
    })
    .catch(error => {
        // This .catch() will handle:
        // 1. Network errors (fetch promise rejected)
        // 2. Errors thrown from .then() blocks (e.g., !response.ok, JSON parsing errors, or our Promise.reject calls)
        console.error('Error fetching or processing price data:', error);
        dateElement.textContent = 'Error loading price data.';
        fineGoldTolaElement.textContent = 'Tola: N/A';
        fineGoldGramElement.textContent = '10 Grams: N/A';
        tejabiGoldTolaElement.textContent = 'Tola: N/A';
        tejabiGoldGramElement.textContent = '10 Grams: N/A';
        silverTolaElement.textContent = 'Tola: N/A';
        silverGramElement.textContent = '10 Grams: N/A';
    });