const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const SettingsStore = require('./store');

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Defaults
const store = new SettingsStore({
  workInterval: 20, // in minutes
  breakDuration: 20, // in seconds
  autostart: true,
  theme: 'system', // 'light' | 'dark' | 'system'
  sound: false
});

let settingsWindow = null;
let overlayWindow = null;
let tray = null;

// Timer State
let timerState = {
  status: 'running', // 'running' | 'paused' | 'break'
  secondsRemaining: store.get('workInterval') * 60,
  totalWorkSeconds: store.get('workInterval') * 60,
  breakSecondsRemaining: store.get('breakDuration'),
  totalBreakSeconds: store.get('breakDuration'),
  pauseUntil: null // Date timestamp if paused for duration
};

let timerInterval = null;

// Convert SVG asset to nativeImage
function getIconImage(svgFilename, size = 32) {
  const svgPath = path.join(__dirname, 'assets', svgFilename);
  if (fs.existsSync(svgPath)) {
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    const base64 = Buffer.from(svgContent).toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${base64}`;
    const img = nativeImage.createFromDataURL(dataUrl);
    return img.resize({ width: size, height: size });
  }
  return nativeImage.createEmpty();
}

function updateAutostartSetting(enable) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      openAsHidden: true
    });
  } catch (err) {
    console.error('Failed to configure autostart setting:', err);
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateTrayToolTip() {
  if (!tray) return;
  if (timerState.status === 'running') {
    tray.setToolTip(`Eye Saver — Next break in ${formatTime(timerState.secondsRemaining)}`);
  } else if (timerState.status === 'paused') {
    if (timerState.pauseUntil) {
      const diffMs = timerState.pauseUntil - Date.now();
      const diffMin = Math.max(0, Math.ceil(diffMs / 60000));
      tray.setToolTip(`Eye Saver — Paused (${diffMin} min left)`);
    } else {
      tray.setToolTip('Eye Saver — Paused');
    }
  } else if (timerState.status === 'break') {
    tray.setToolTip('Eye Saver — Rest your eyes now!');
  }
}

function buildTrayContextMenu() {
  const isPaused = timerState.status === 'paused';

  const menuTemplate = [
    {
      label: 'Eye Saver Dashboard',
      click: () => showSettingsWindow()
    },
    {
      label: 'Take Break Now',
      click: () => startBreakOverlay()
    },
    { type: 'separator' },
    {
      label: isPaused ? '▶ Resume Timer' : '⏸ Pause Timer',
      click: () => {
        if (isPaused) {
          resumeTimerState();
        } else {
          pauseTimerState(60); // Default pause 1 hour
        }
      }
    },
    {
      label: 'Pause Options',
      submenu: [
        { label: 'For 30 minutes', click: () => pauseTimerState(30) },
        { label: 'For 1 hour', click: () => pauseTimerState(60) },
        { label: 'For 2 hours', click: () => pauseTimerState(120) },
        { label: 'Until tomorrow', click: () => pauseTimerUntilTomorrow() }
      ]
    },
    { type: 'separator' },
    {
      label: 'Quit Eye Saver',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ];

  return Menu.buildFromTemplate(menuTemplate);
}

function createTray() {
  const icon = getIconImage('tray-eye.svg', 16);
  tray = new Tray(icon);
  tray.setToolTip('Eye Saver');
  tray.setContextMenu(buildTrayContextMenu());

  tray.on('click', () => {
    toggleSettingsWindow();
  });
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 460,
    height: 640,
    resizable: false,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0C0A09',
    icon: getIconImage('eye.svg', 64),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  settingsWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      settingsWindow.hide();
    }
  });
}

function showSettingsWindow() {
  if (!settingsWindow) createSettingsWindow();
  settingsWindow.show();
  settingsWindow.focus();
}

function toggleSettingsWindow() {
  if (!settingsWindow) {
    createSettingsWindow();
    settingsWindow.show();
  } else if (settingsWindow.isVisible()) {
    settingsWindow.hide();
  } else {
    settingsWindow.show();
    settingsWindow.focus();
  }
}

function startBreakOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus();
    return;
  }

  timerState.status = 'break';
  timerState.breakSecondsRemaining = store.get('breakDuration');
  timerState.totalBreakSeconds = store.get('breakDuration');

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: primaryDisplay.bounds.x,
    y: primaryDisplay.bounds.y,
    fullscreen: true,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    backgroundColor: '#0C0A09',
    icon: getIconImage('eye.svg', 64),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.loadFile(path.join(__dirname, 'src', 'overlay.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    if (timerState.status === 'break') {
      resetTimerState();
    }
  });

  broadcastTimerUpdate();
  if (tray) tray.setContextMenu(buildTrayContextMenu());
}

function dismissBreakOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
  resetTimerState();
}

function resetTimerState() {
  const workMins = store.get('workInterval');
  timerState.status = 'running';
  timerState.secondsRemaining = workMins * 60;
  timerState.totalWorkSeconds = workMins * 60;
  timerState.pauseUntil = null;

  broadcastTimerUpdate();
  if (tray) tray.setContextMenu(buildTrayContextMenu());
}

function pauseTimerState(durationMinutes) {
  timerState.status = 'paused';
  timerState.pauseUntil = Date.now() + durationMinutes * 60 * 1000;
  broadcastTimerUpdate();
  if (tray) tray.setContextMenu(buildTrayContextMenu());
}

function pauseTimerUntilTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0); // 8:00 AM tomorrow
  timerState.status = 'paused';
  timerState.pauseUntil = tomorrow.getTime();
  broadcastTimerUpdate();
  if (tray) tray.setContextMenu(buildTrayContextMenu());
}

function resumeTimerState() {
  timerState.status = 'running';
  timerState.pauseUntil = null;
  broadcastTimerUpdate();
  if (tray) tray.setContextMenu(buildTrayContextMenu());
}

function broadcastTimerUpdate() {
  updateTrayToolTip();
  const data = { ...timerState };
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('timer-update', data);
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('timer-update', data);
  }
}

function initTimerEngine() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (timerState.status === 'running') {
      if (timerState.secondsRemaining > 0) {
        timerState.secondsRemaining -= 1;
      } else {
        startBreakOverlay();
      }
    } else if (timerState.status === 'break') {
      if (timerState.breakSecondsRemaining > 0) {
        timerState.breakSecondsRemaining -= 1;
      } else {
        dismissBreakOverlay();
      }
    } else if (timerState.status === 'paused') {
      if (timerState.pauseUntil && Date.now() >= timerState.pauseUntil) {
        resumeTimerState();
      }
    }
    broadcastTimerUpdate();
  }, 1000);
}

// IPC Handlers
ipcMain.handle('get-settings', () => store.getAll());

ipcMain.handle('save-settings', (_event, newSettings) => {
  store.setAll(newSettings);

  // Update autostart if changed
  if (newSettings.autostart !== undefined) {
    updateAutostartSetting(newSettings.autostart);
  }

  // Adjust timer total if work interval changed and timer is running
  if (newSettings.workInterval && timerState.status === 'running') {
    const newTotal = newSettings.workInterval * 60;
    if (timerState.secondsRemaining > newTotal) {
      timerState.secondsRemaining = newTotal;
    }
    timerState.totalWorkSeconds = newTotal;
  }

  if (newSettings.breakDuration && timerState.status === 'break') {
    timerState.totalBreakSeconds = newSettings.breakDuration;
  }

  // Notify renderer processes of theme changes
  if (newSettings.theme) {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('theme-update', newSettings.theme);
    }
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('theme-update', newSettings.theme);
    }
  }

  broadcastTimerUpdate();
  return store.getAll();
});

ipcMain.handle('get-timer-state', () => ({ ...timerState }));

ipcMain.handle('trigger-break-now', () => {
  startBreakOverlay();
  return true;
});

ipcMain.handle('pause-timer', (_event, durationMinutes) => {
  if (durationMinutes === 'tomorrow') {
    pauseTimerUntilTomorrow();
  } else {
    pauseTimerState(durationMinutes);
  }
  return true;
});

ipcMain.handle('resume-timer', () => {
  resumeTimerState();
  return true;
});

ipcMain.handle('dismiss-overlay', () => {
  dismissBreakOverlay();
  return true;
});

ipcMain.handle('snooze-break', (_event, durationMinutes) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
  if (durationMinutes === 'tomorrow') {
    pauseTimerUntilTomorrow();
  } else {
    pauseTimerState(durationMinutes);
  }
  return true;
});

ipcMain.handle('close-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.hide();
  }
});

ipcMain.handle('minimize-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.minimize();
  }
});

// App Lifecycle
app.whenReady().then(() => {
  createTray();
  createSettingsWindow();
  initTimerEngine();
  updateAutostartSetting(store.get('autostart'));

  // Listen to OS theme changes
  nativeTheme.on('updated', () => {
    if (store.get('theme') === 'system') {
      const isDark = nativeTheme.shouldUseDarkColors;
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('theme-update', 'system');
      }
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('theme-update', 'system');
      }
    }
  });

  // Default behavior on initial startup: show settings window
  showSettingsWindow();
});

app.on('second-instance', () => {
  showSettingsWindow();
});

app.on('window-all-closed', (e) => {
  // Prevent app from quitting when all windows are closed (runs in tray)
  e.preventDefault();
});
