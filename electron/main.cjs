'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');

let bridge = null;
let quitting = false;

function startBridge() {
  return new Promise((resolve, reject) => {
    const bridgePath = path.join(app.getAppPath(), 'traffic-bridge.js');
    bridge = spawn(process.execPath, [bridgePath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: '0',
        // A desktop install must always start in the fail-safe state.
        JMRI_TC_ENABLE_DCC: '0',
        JMRI_TC_SAFETY_VALIDATED: '0'
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      windowsHide: true
    });

    let settled = false;
    const timeout = setTimeout(() => finish(new Error('El pont local no ha iniciat en 15 segons.')), 15000);
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
    };

    bridge.on('message', message => {
      if (message && message.type === 'ready' && Number.isInteger(message.port)) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(message.port);
      }
    });
    bridge.once('error', error => finish(error));
    bridge.once('exit', (code, signal) => {
      if (!quitting) finish(new Error(`El pont local s'ha tancat (codi ${code ?? signal}).`));
    });
    bridge.stdout.on('data', chunk => console.log('[JMRI bridge]', chunk.toString().trim()));
    bridge.stderr.on('data', chunk => console.error('[JMRI bridge]', chunk.toString().trim()));
  });
}

async function createWindow() {
  const port = await startBridge();
  const window = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#101b28',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.once('ready-to-show', () => window.show());
  await window.loadURL(`http://127.0.0.1:${port}`);
  window.on('closed', () => {
    if (app.quit) app.quit();
  });
}

app.whenReady().then(createWindow).catch(async error => {
  console.error(error);
  await dialog.showMessageBox({
    type: 'error',
    title: 'JMRI TC Gold Custom',
    message: 'No s’ha pogut iniciar el pont local.',
    detail: error.message
  });
  app.quit();
});

app.on('before-quit', () => {
  quitting = true;
  if (bridge && !bridge.killed) bridge.kill();
});

app.on('window-all-closed', () => app.quit());
