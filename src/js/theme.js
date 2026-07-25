// Theme Management System
(function() {
  function applyTheme(themeMode) {
    const root = document.documentElement;
    if (themeMode === 'system') {
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', themeMode);
    }
    
    // Update theme toggle icon if present
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    if (sunIcon && moonIcon) {
      const currentApplied = root.getAttribute('data-theme');
      if (currentApplied === 'dark') {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      }
    }
  }

  // Initial load theme check
  if (window.eyeSaverAPI) {
    window.eyeSaverAPI.getSettings().then(settings => {
      if (settings && settings.theme) {
        applyTheme(settings.theme);
      }
    });

    window.eyeSaverAPI.onThemeUpdate((theme) => {
      applyTheme(theme);
    });
  }

  // Listen for system theme changes if in system mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (window.eyeSaverAPI) {
      window.eyeSaverAPI.getSettings().then(settings => {
        if (settings && settings.theme === 'system') {
          applyTheme('system');
        }
      });
    }
  });

  window.applyTheme = applyTheme;
})();
