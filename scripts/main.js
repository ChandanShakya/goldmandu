
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