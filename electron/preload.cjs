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
  getDisplays: () => ipcRenderer.invoke('native-window:displays'),
  getNativeWindows: () => ipcRenderer.invoke('native-window:list'),
  openNativeWindow: options => ipcRenderer.invoke('native-window:open', options),
  openNativePanel: options => ipcRenderer.invoke('native-window:open', { ...options, type: 'desktopPanel' }),
  getWorkspaceState: () => ipcRenderer.invoke('native-window:get-state'),
  moveNativeWindow: options => ipcRenderer.invoke('native-window:move', options),
  closeNativeWindow: id => ipcRenderer.invoke('native-window:close', id),
  showAllNativeWindows: () => ipcRenderer.invoke('native-window:show-all'),
  toggleAlwaysOnTop: enabled => ipcRenderer.invoke('native-window:toggle-always-on-top', enabled),
  isAlwaysOnTop: () => ipcRenderer.invoke('native-window:is-always-on-top'),
  publishWorkspaceState: state => ipcRenderer.invoke('native-window:publish-state', state),
  onNativeWindowClosed: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, details) => callback(details);
    ipcRenderer.on('workspace:window-closed', listener);
    return () => ipcRenderer.removeListener('workspace:window-closed', listener);
  },
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
