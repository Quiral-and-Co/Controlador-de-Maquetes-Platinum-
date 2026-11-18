'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jmriDesktop', Object.freeze({
  openProject: options => ipcRenderer.invoke('project:open', options),
  saveProject: options => ipcRenderer.invoke('project:save', options),
  confirmDiscard: () => ipcRenderer.invoke('project:confirm-discard'),
  createBackup: filePath => ipcRenderer.invoke('project:backup', filePath),
  printDocument: () => ipcRenderer.invoke('document:print'),
  printPreview: () => ipcRenderer.invoke('document:preview'),
  pageSetup: () => ipcRenderer.invoke('document:page-setup'),
  setUiMode: mode => { if (mode === 'classic' || mode === 'modern') ipcRenderer.send('ui:mode', mode); },
  onCommand: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('app:command', listener);
    return () => ipcRenderer.removeListener('app:command', listener);
  }
}));
