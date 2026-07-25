const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eyeSaverAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getTimerState: () => ipcRenderer.invoke('get-timer-state'),
  triggerBreakNow: () => ipcRenderer.invoke('trigger-break-now'),
  pauseTimer: (durationMinutes) => ipcRenderer.invoke('pause-timer', durationMinutes),
  resumeTimer: () => ipcRenderer.invoke('resume-timer'),
  dismissOverlay: () => ipcRenderer.invoke('dismiss-overlay'),
  snoozeBreak: (durationMinutes) => ipcRenderer.invoke('snooze-break', durationMinutes),
  closeSettings: () => ipcRenderer.invoke('close-settings'),
  minimizeSettings: () => ipcRenderer.invoke('minimize-settings'),
  onTimerUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('timer-update', handler);
    return () => ipcRenderer.removeListener('timer-update', handler);
  },
  onThemeUpdate: (callback) => {
    const handler = (_event, theme) => callback(theme);
    ipcRenderer.on('theme-update', handler);
    return () => ipcRenderer.removeListener('theme-update', handler);
  }
});
