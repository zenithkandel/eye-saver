const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SettingsStore {
  constructor(defaults) {
    this.userDataPath = app.getPath('userData');
    this.path = path.join(this.userDataPath, 'settings.json');
    this.defaults = defaults;
    this.data = this.parseDataFile(this.path, this.defaults);
  }

  get(key) {
    return this.data[key] !== undefined ? this.data[key] : this.defaults[key];
  }

  getAll() {
    return { ...this.defaults, ...this.data };
  }

  set(key, val) {
    this.data[key] = val;
    this.saveData();
  }

  setAll(newSettings) {
    this.data = { ...this.data, ...newSettings };
    this.saveData();
  }

  parseDataFile(filePath, defaults) {
    try {
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, 'utf8');
        return { ...defaults, ...JSON.parse(fileData) };
      }
    } catch (error) {
      console.error('Error reading settings file, using defaults:', error);
    }
    return defaults;
  }

  saveData() {
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving settings file:', error);
    }
  }
}

module.exports = SettingsStore;
