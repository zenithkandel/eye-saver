document.addEventListener('DOMContentLoaded', async () => {
  const api = window.eyeSaverAPI;

  const overlayCountdown = document.getElementById('overlay-countdown');
  const overlayRingPath = document.getElementById('overlay-ring-path');
  const skipBtn = document.getElementById('skip-btn');
  const bypassBtns = document.querySelectorAll('.btn-bypass');

  const RING_CIRCUMFERENCE = 276.46;

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function updateOverlay(state) {
    if (!state) return;
    const remaining = state.breakSecondsRemaining || 0;
    const total = state.totalBreakSeconds || 20;

    overlayCountdown.textContent = formatTime(remaining);

    const progress = Math.max(0, Math.min(1, remaining / total));
    const strokeDashoffset = RING_CIRCUMFERENCE - (progress * RING_CIRCUMFERENCE);
    overlayRingPath.style.strokeDashoffset = strokeDashoffset;
  }

  if (api) {
    const initialState = await api.getTimerState();
    updateOverlay(initialState);

    api.onTimerUpdate((state) => {
      updateOverlay(state);
    });
  }

  // Skip Button Action
  skipBtn.addEventListener('click', async () => {
    if (api) await api.dismissOverlay();
  });

  // Bypass / Snooze Option Buttons
  bypassBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const snoozeVal = btn.getAttribute('data-snooze');
      if (api) {
        if (snoozeVal === 'tomorrow') {
          await api.snoozeBreak('tomorrow');
        } else {
          await api.snoozeBreak(parseInt(snoozeVal, 10));
        }
      }
    });
  });

  // ESC key to dismiss break
  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      if (api) await api.dismissOverlay();
    }
  });
});
