let updateInterval = null;
let currentRemainingMs = 0;
let isBlocked = false;
let config = null;

// Clean up leftover DOM from a previous content script instance (e.g., after extension reload)
const _prevTimer = document.getElementById('wtl-timer-root');
const _prevBlock = document.getElementById('wtl-block-root');
if (_prevTimer) _prevTimer.remove();
if (_prevBlock) _prevBlock.remove();
if (document.body) document.body.style.removeProperty('overflow');

// Avoid multiple injections within the same script instance
if (!window._wtl_injected) {
  window._wtl_injected = true;

  // Create UI Elements
  const timerEl = document.createElement('div');
  timerEl.id = 'wtl-timer-root';
  timerEl.className = 'wtl-hidden';
  timerEl.innerHTML = `
    <svg class="wtl-icon-clock" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
    <span id="wtl-time-text">00:00</span>
  `;

  function makeDraggable(el) {
    let _isDragging = false;

    el.addEventListener('mousedown', (e) => {
      _isDragging = false;
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = el.getBoundingClientRect();
      const initLeft = rect.left;
      const initBottom = window.innerHeight - rect.bottom;

      el.style.cursor = 'grabbing';
      el.style.transition = 'none';

      function onMouseMove(moveEvent) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          _isDragging = true;
        }
        if (_isDragging) {
          el.style.left = `${initLeft + dx}px`;
          el.style.bottom = `${initBottom - dy}px`;
          el.style.right = 'auto';
        }
      }

      function onMouseUp() {
        el.style.cursor = 'grab';
        el.style.transition = 'opacity 0.3s';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    return { get wasDragging() { return _isDragging; } };
  }

  const drag = makeDraggable(timerEl);

  timerEl.addEventListener('click', () => {
    if (!drag.wasDragging) {
      sendMessage(MSG.OPEN_OPTIONS_PAGE);
    }
  });

  const blockEl = document.createElement('div');
  blockEl.id = 'wtl-block-root';
  blockEl.className = 'wtl-hidden';

  // Inject early
  if (document.documentElement) {
    document.documentElement.appendChild(timerEl);
    document.documentElement.appendChild(blockEl);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.appendChild(timerEl);
      document.documentElement.appendChild(blockEl);
    });
  }

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds >= 3600) {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      let text = `${h} h`;
      if (m > 0) text += ` ${m} min`;
      if (s > 0) text += ` ${s} sec`;
      return text + ` left`;
    } else if (totalSeconds >= 60) {
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return s > 0 ? `${m} min ${s} sec left` : `${m} min left`;
    } else {
      return `${totalSeconds} sec left`;
    }
  }

  function updateUI() {
    if (isBlocked) return;

    if (currentRemainingMs <= 0) {
      triggerBlock();
      return;
    }

    if (config && config.showTimer) {
      timerEl.classList.remove('wtl-hidden');
      document.getElementById('wtl-time-text').textContent = formatTime(currentRemainingMs);
    } else {
      timerEl.classList.add('wtl-hidden');
    }
  }

  function triggerBlock() {
    isBlocked = true;
    timerEl.classList.add('wtl-hidden');

    // Render block screen
    blockEl.innerHTML = `
      <svg class="block-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
      </svg>
      <h1>Time's Up!</h1>
      <p>You've reached your daily limit for the <strong>${config.category}</strong> category.</p>
      <p style="margin-top:32px; font-size:15px;">(Close the tab or <a id="wtl-options-link" href="#" style="color: inherit; text-decoration: underline; cursor: pointer;">open options</a>)</p>
    `;
    blockEl.classList.remove('wtl-hidden');

    // Prevent scrolling
    if (document.body) {
      document.body.style.overflow = 'hidden';
    }

    // Stop event propagation to make the page completely unusable
    document.addEventListener('keydown', stopEvent, true);
    document.addEventListener('click', stopEvent, true);
    document.addEventListener('scroll', stopEvent, true);
    document.addEventListener('wheel', stopEvent, true);

    // Clear the tick interval
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  }

  function stopEvent(e) {
    if (e.target && e.target.id === 'wtl-options-link') {
      if (e.type === 'click') {
        sendMessage(MSG.OPEN_OPTIONS_PAGE);
      }
      return;
    }
    e.stopPropagation();
    e.preventDefault();
  }

  function tick() {
    if (!document.hidden && document.hasFocus() && !isBlocked) {
      currentRemainingMs -= 1000;
      updateUI();
    }
  }

  function initFromState(state) {
    if (!state || !state.isActive) {
      if (updateInterval) clearInterval(updateInterval);
      timerEl.classList.add('wtl-hidden');
      if (isBlocked) unblock();
      return;
    }

    config = state;
    currentRemainingMs = state.remainingMs;

    timerEl.setAttribute('data-theme', config.theme || 'auto');
    blockEl.setAttribute('data-theme', config.theme || 'auto');

    if (currentRemainingMs <= 0) {
      triggerBlock();
    } else {
      if (isBlocked) unblock();
      else isBlocked = false;
      
      updateUI();
      if (!updateInterval) {
        updateInterval = setInterval(tick, 1000);
      }
    }
  }

  function unblock() {
    isBlocked = false;
    blockEl.classList.add('wtl-hidden');
    document.body.style.removeProperty('overflow');
    document.removeEventListener('keydown', stopEvent, true);
    document.removeEventListener('click', stopEvent, true);
    document.removeEventListener('scroll', stopEvent, true);
    document.removeEventListener('wheel', stopEvent, true);
    if (!updateInterval) {
      updateInterval = setInterval(tick, 1000);
    }
  }

  // Listen for push updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MSG.TIMER_UPDATE) {
      currentRemainingMs = message.remainingMs;
      if (isBlocked && currentRemainingMs > 0) {
        unblock();
      }
      updateUI();
    } else if (message.type === MSG.DAY_ROLLED_OVER) {
      requestState();
    }
  });

  // Fetch current state on load
  function requestState() {
    try {
      if (!chrome.runtime?.id) {
        // Extension context invalidated (extension was reloaded/updated) — reload to get a fresh content script
        location.reload();
        return;
      }
      chrome.runtime.sendMessage({ type: MSG.GET_CURRENT_STATE, url: window.location.href }, (response) => {
        if (chrome.runtime.lastError) {
          // Retry later if background script wasn't ready
          setTimeout(requestState, 1000);
          return;
        }
        initFromState(response);
      });
    } catch (e) {
      // Extension context invalidated — reload the page
      location.reload();
    }
  }

  requestState();

  // Detect tab visibility changes
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && config && config.isActive) {
      // Re-sync when tab becomes visible again to prevent drift or unblock after day reset
      requestState();
    }
  });

  // Detect window focus changes
  window.addEventListener('focus', () => {
    if (config && config.isActive) {
      requestState();
    }
  });
}
