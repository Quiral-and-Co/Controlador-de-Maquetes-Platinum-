'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jmriDesktop', Object.freeze({
  openProject: options => ipcRenderer.invoke('project:open', options),
  importZ21Database: bytes => ipcRenderer.invoke('rolling-stock:import-z21', bytes),
  saveProject: options => ipcRenderer.invoke('project:save', options),
  confirmDiscard: () => ipcRenderer.invoke('project:confirm-discard'),
  createBackup: filePath => ipcRenderer.invoke('project:backup', filePath),
  printDocument: () => ipcRenderer.invoke('document:print'),
  printPreview: () => ipcRenderer.invoke('document:preview'),
  pageSetup: () => ipcRenderer.invoke('document:page-setup'),
  setUiMode: mode => { if (mode === 'classic' || mode === 'modern') ipcRenderer.send('ui:mode', mode); },
  getDisplays: () => ipcRenderer.invoke('native-window:displays'),
  getNativeWindows: () => ipcRenderer.invoke('native-window:list'),
  openNativeWindow: options => ipcRenderer.invoke('native-window:open', options),
  moveNativeWindow: options => ipcRenderer.invoke('native-window:move', options),
  closeNativeWindow: id => ipcRenderer.invoke('native-window:close', id),
  showAllNativeWindows: () => ipcRenderer.invoke('native-window:show-all'),
  publishWorkspaceState: state => ipcRenderer.invoke('native-window:publish-state', state),
  onWorkspaceState: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('workspace:state', listener);
    return () => ipcRenderer.removeListener('workspace:state', listener);
  },
  onDisplaysChanged: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, displays) => callback(displays);
    ipcRenderer.on('workspace:displays-changed', listener);
    return () => ipcRenderer.removeListener('workspace:displays-changed', listener);
  },
  onCommand: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('app:command', listener);
    return () => ipcRenderer.removeListener('app:command', listener);
  }
}));
