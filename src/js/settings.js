document.addEventListener('DOMContentLoaded', async () => {
  const api = window.eyeSaverAPI;

  // DOM Elements
  const timerCountdown = document.getElementById('timer-countdown');
  const timerModeLabel = document.getElementById('timer-mode-label');
  const timerRingPath = document.getElementById('timer-ring-path');
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  
  const breakNowBtn = document.getElementById('break-now-btn');
  const resumeBtn = document.getElementById('resume-btn');
  
  const workSlider = document.getElementById('work-slider');
  const workVal = document.getElementById('work-val');
  const breakSlider = document.getElementById('break-slider');
  const breakVal = document.getElementById('break-val');
  const autostartToggle = document.getElementById('autostart-toggle');
  
  const themeBtn = document.getElementById('theme-btn');
  const minimizeBtn = document.getElementById('minimize-btn');
  const closeBtn = document.getElementById('close-btn');

  const RING_CIRCUMFERENCE = 276.46; // 2 * Math.PI * 44

  let currentSettings = {};

  // Format Seconds to MM:SS
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Update Visual Progress Ring
  function updateProgressRing(secondsRemaining, totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return;
    const progress = Math.max(0, Math.min(1, secondsRemaining / totalSeconds));
    const strokeDashoffset = RING_CIRCUMFERENCE - (progress * RING_CIRCUMFERENCE);
    timerRingPath.style.strokeDashoffset = strokeDashoffset;
  }

  // Update Dashboard State
  function renderTimerState(state) {
    if (!state) return;

    if (state.status === 'running') {
      timerCountdown.textContent = formatTime(state.secondsRemaining);
      timerModeLabel.textContent = 'UNTIL BREAK';
      statusBadge.className = 'status-badge';
      statusText.textContent = 'Active Timer';
      breakNowBtn.style.display = 'inline-flex';
      resumeBtn.style.display = 'none';
      updateProgressRing(state.secondsRemaining, state.totalWorkSeconds);
    } else if (state.status === 'paused') {
      if (state.pauseUntil) {
        const diffSec = Math.max(0, Math.ceil((state.pauseUntil - Date.now()) / 1000));
        timerCountdown.textContent = formatTime(diffSec);
        timerModeLabel.textContent = 'PAUSED';
      } else {
        timerCountdown.textContent = 'PAUSED';
        timerModeLabel.textContent = 'PAUSED';
      }
      statusBadge.className = 'status-badge paused';
      statusText.textContent = 'Timer Paused';
      breakNowBtn.style.display = 'none';
      resumeBtn.style.display = 'inline-flex';
      timerRingPath.style.strokeDashoffset = RING_CIRCUMFERENCE;
    } else if (state.status === 'break') {
      timerCountdown.textContent = formatTime(state.breakSecondsRemaining);
      timerModeLabel.textContent = 'ON BREAK';
      statusBadge.className = 'status-badge break';
      statusText.textContent = 'Break in Progress';
      breakNowBtn.style.display = 'none';
      resumeBtn.style.display = 'none';
      updateProgressRing(state.breakSecondsRemaining, state.totalBreakSeconds);
    }
  }

  // Load Initial Settings
  if (api) {
    currentSettings = await api.getSettings();

    // Populate UI
    workSlider.value = currentSettings.workInterval;
    workVal.textContent = `${currentSettings.workInterval} min`;

    breakSlider.value = currentSettings.breakDuration;
    breakVal.textContent = `${currentSettings.breakDuration} sec`;

    autostartToggle.checked = currentSettings.autostart !== false;

    // Get Initial Timer State
    const initialState = await api.getTimerState();
    renderTimerState(initialState);

    // Listen for Timer Engine Broadcasts
    api.onTimerUpdate((state) => {
      renderTimerState(state);
    });
  }

  // Setting Control Event Listeners
  workSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    workVal.textContent = `${val} min`;
  });

  workSlider.addEventListener('change', async (e) => {
    const val = parseInt(e.target.value, 10);
    currentSettings.workInterval = val;
    await api.saveSettings(currentSettings);
  });

  breakSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    breakVal.textContent = `${val} sec`;
  });

  breakSlider.addEventListener('change', async (e) => {
    const val = parseInt(e.target.value, 10);
    currentSettings.breakDuration = val;
    await api.saveSettings(currentSettings);
  });

  autostartToggle.addEventListener('change', async (e) => {
    currentSettings.autostart = e.target.checked;
    await api.saveSettings(currentSettings);
  });

  // Action Buttons
  breakNowBtn.addEventListener('click', async () => {
    await api.triggerBreakNow();
  });

  resumeBtn.addEventListener('click', async () => {
    await api.resumeTimer();
  });

  // Quick Pause Pills
  document.querySelectorAll('.pause-opt-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const dur = btn.getAttribute('data-duration');
      if (dur === 'tomorrow') {
        await api.pauseTimer('tomorrow');
      } else {
        await api.pauseTimer(parseInt(dur, 10));
      }
    });
  });

  // Theme Toggle Button (Cycles: System -> Dark -> Light)
  themeBtn.addEventListener('click', async () => {
    const root = document.documentElement;
    const currentApplied = root.getAttribute('data-theme');
    let nextTheme = 'dark';
    if (currentApplied === 'dark') {
      nextTheme = 'light';
    } else if (currentApplied === 'light') {
      nextTheme = 'dark';
    }

    currentSettings.theme = nextTheme;
    window.applyTheme(nextTheme);
    await api.saveSettings(currentSettings);
  });

  // Window Controls
  minimizeBtn.addEventListener('click', () => {
    api.minimizeSettings();
  });

  closeBtn.addEventListener('click', () => {
    api.closeSettings();
  });
});
