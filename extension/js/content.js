// extension/js/content.js

let blockOverlay = null;
let timerElement = null;

// Ensure timer is cleanly formatted (MM:SS)
function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Render the on-page floating timer
function updateFloatingTimer(remainingMs) {
    if (!timerElement) {
        timerElement = document.createElement('div');
        timerElement.className = 'limitly-floating-timer';
        document.body.appendChild(timerElement);
    }
    
    // Only show if there's an active limit being tracked (e.g. not unlimited)
    if (remainingMs === undefined || remainingMs === null) {
        timerElement.style.display = 'none';
        return;
    }

    timerElement.style.display = 'block';
    timerElement.textContent = formatTime(remainingMs);
    
    if (remainingMs < 60000) { // Under 1 minute
        timerElement.classList.add('danger');
    } else {
        timerElement.classList.remove('danger');
    }
}

// Put up the giant block wall if time is out
function enforceBlock(categoryName) {
    if (blockOverlay) return; // Already blocked
    
    // Hide the timer if we are blocking
    if (timerElement) timerElement.style.display = 'none';

    blockOverlay = document.createElement('div');
    blockOverlay.className = 'limitly-block-overlay';
    
    const iconUrl = chrome.runtime.getURL('icons/icon128.png');
    
    blockOverlay.innerHTML = `
        <img src="${iconUrl}" class="limitly-logo" alt="Limitly" onerror="this.style.display='none'">
        <h1>Time's Up!</h1>
        <p>You have reached your daily limit for <strong>${categoryName}</strong>.</p>
        <p>Take a deep breath and close this tab to regain your focus.</p>
        <button class="limitly-btn" id="limitlyCloseTabBtn">Close Tab</button>
    `;
    
    document.body.appendChild(blockOverlay);
    document.body.style.overflow = 'hidden'; // Stop scrolling behind the overlay

    // Attach listener to kill tab
    document.getElementById('limitlyCloseTabBtn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'CLOSE_TAB' });
    });
}

// Remove block wall if circumstances changed
function removeBlock() {
    if (blockOverlay) {
        blockOverlay.remove();
        blockOverlay = null;
        document.body.style.overflow = '';
    }
}

// Listen for the background telling us a sync loop just processed
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TIMER_UPDATE') {
        if (message.remainingMs <= 0) {
            enforceBlock(message.category);
        } else {
            removeBlock();
            updateFloatingTimer(message.remainingMs);
        }
    } else if (message.type === 'DAY_ROLLED_OVER') {
        removeBlock();
    }
});

// Immediately on boot, ask the background worker for our status
chrome.runtime.sendMessage({ type: 'GET_CURRENT_STATE', url: window.location.href }, (response) => {
    if (chrome.runtime.lastError || !response) return;
    
    if (response.isActive) {
        if (response.remainingMs <= 0) {
            enforceBlock(response.category);
        } else {
            updateFloatingTimer(response.remainingMs);
        }
    }
});