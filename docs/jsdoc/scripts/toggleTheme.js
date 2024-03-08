function toggleDarkMode() {
    var elements = [document.body, document.querySelector('nav'), document.querySelector('article'), document.querySelector('table')];
    var isDarkMode = document.body.classList.contains('dark-mode');
    var newMode = isDarkMode ? 'light' : 'dark';

    // Toggle the class on each element
    elements.forEach(function(el) {
        if (el) { // Check if the element exists
            if (isDarkMode) {
                el.classList.remove('dark-mode');
            } else {
                el.classList.add('dark-mode');
            }
        }
    });

    // Update the checkbox state
    document.getElementById('theme-toggle').checked = !isDarkMode;

    // Save the new mode in localStorage
    localStorage.setItem('mode', newMode);
}

// Set the initial state of the toggle button and apply the theme on page load
document.addEventListener('DOMContentLoaded', function() {
    var savedMode = localStorage.getItem('mode');
    var themeToggle = document.getElementById('theme-toggle');

    if (savedMode === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.checked = true;
    } else {
        themeToggle.checked = false;
    }

    // Ensure all elements are updated to reflect the saved mode
    toggleDarkMode();
    toggleDarkMode(); // Toggle twice to set the correct state without altering the saved mode
});
