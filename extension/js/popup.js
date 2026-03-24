document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('optionsBtn').addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('html/options.html'));
        }
    });
});
