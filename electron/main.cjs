'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const os = require('node:os');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { createProjectPathPolicy } = require('./project-path-policy.cjs');

let bridge = null;
let quitting = false;
let mainWindow = null;
const approvedProjectPaths = createProjectPathPolicy();
const MAX_PROJECT_BYTES = 25 * 1024 * 1024;

const projectFilters = [
  { name: 'Projectes JMRI TC', extensions: ['json'] },
  { name: 'Disseny XTrackCAD', extensions: ['xtc', 'xti', 'xtm'] },
  { name: 'Tots els fitxers', extensions: ['*'] }
];

function installProjectHandlers() {
  ipcMain.handle('project:open', async (_event, options = {}) => {
    const filters = options.importXtc === true ? [{ name: 'Disseny XTrackCAD', extensions: ['xtc', 'xti', 'xtm'] }, projectFilters[2]] : projectFilters;
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Obrir un projecte', buttonLabel: 'Obrir', properties: ['openFile'], filters });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf8');
    approvedProjectPaths.authorize(filePath);
    return { canceled: false, filePath, fileName: path.basename(filePath), content };
  });
  ipcMain.handle('project:save', async (_event, options = {}) => {
    let filePath = '';
    if (options.saveAs === true || typeof options.filePath !== 'string' || !options.filePath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Desar el projecte', buttonLabel: 'Desar',
        defaultPath: path.basename(typeof options.defaultPath === 'string' ? options.defaultPath : 'JMRI_TC_Gold_Custom_layout.json'),
        filters: projectFilters.slice(0, 2)
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      filePath = result.filePath;
      approvedProjectPaths.authorize(filePath);
    } else {
      filePath = options.filePath;
      if (!approvedProjectPaths.isAuthorized(filePath)) {
        throw new Error('Ruta de desat no autoritzada. Utilitza el diàleg natiu de desat.');
      }
    }
    const content = String(options.content ?? '');
    if (Buffer.byteLength(content, 'utf8') > MAX_PROJECT_BYTES) {
      throw new Error('El projecte supera la mida màxima permesa de 25 MB.');
    }
    await fs.writeFile(filePath, content, { encoding: 'utf8', flag: 'w' });
    return { canceled: false, filePath, fileName: path.basename(filePath) };
  });
  ipcMain.handle('project:backup', async (_event, filePath) => {
    if (typeof filePath !== 'string' || !approvedProjectPaths.isAuthorized(filePath)) throw new Error('No hi ha cap projecte desat i autoritzat per fer-ne una còpia de seguretat.');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = filePath.replace(/(\\.[^.]+)?$/, `.backup-${stamp}$1`);
    await fs.copyFile(filePath, backupPath, require('node:fs').constants.COPYFILE_EXCL);
    return { backupPath, fileName: path.basename(backupPath) };
  });
  ipcMain.handle('document:print', async () => new Promise(resolve => mainWindow.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => resolve({ success, failureReason: failureReason || '' }))));
  ipcMain.handle('document:preview', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jmri-tc-preview-'));
    const pdfPath = path.join(dir, 'JMRI-TC-vista-previa.pdf');
    const pdf = await mainWindow.webContents.printToPDF({ pageSize: 'A4', landscape: false, printBackground: true, margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 } });
    await fs.writeFile(pdfPath, pdf);
    const error = await shell.openPath(pdfPath);
    if (error) throw new Error(error);
    return { opened: true };
  });
  ipcMain.handle('document:page-setup', async () => new Promise(resolve => mainWindow.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => resolve({ success, failureReason: failureReason || '' }))));
  ipcMain.handle('project:confirm-discard', async () => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning', buttons: ['Cancel·lar', 'Descartar canvis'], defaultId: 0, cancelId: 0,
      title: 'Canvis sense desar', message: 'Hi ha canvis sense desar. Vols descartar-los?'
    });
    return result.response === 1;
  });
}

function installApplicationMenu(mode = 'modern') {
  const activeMode = mode === 'classic' ? 'classic' : 'modern';
  const send = command => mainWindow?.webContents.send('app:command', command);
  const item = (label, command, accelerator) => ({ label, ...(accelerator ? { accelerator } : {}), click: () => send(command) });
  const fileItems = [
    item('Nou', 'new', 'CmdOrCtrl+N'),
    item('Obrir…', 'open', 'CmdOrCtrl+O'),
    { type: 'separator' },
    item('Guardar', 'save', 'CmdOrCtrl+S'),
    item('Guardar com…', 'saveAs', 'CmdOrCtrl+Shift+S'),
    item('Crea còpia de seguretat', 'backup'),
    { type: 'separator' },
    item('Importar XTrackCAD…', 'importXtc'),
    item('Importar elements…', 'importElements'),
    item('Exportar elements seleccionats…', 'exportElements'),
    item('Importar XTrackCAD…', 'importXtc'),
    item('Exportar XTrackCAD…', 'exportXtc'),
    { type: 'separator' },
    item('Configura la pàgina…', 'pageSetup'),
    item('Vista prèvia d’impressió…', 'printPreview'),
    item('Imprimeix…', 'print', 'CmdOrCtrl+P'),
    { type: 'separator' },
    item('Opcions / Preferències…', 'preferences'),
    { type: 'separator' },
    item(activeMode === 'modern' ? 'Menús clàssics' : 'Menús moderns', activeMode === 'modern' ? 'setClassicMode' : 'setModernMode'),
    { type: 'separator' },
    { role: 'quit', label: 'Sortir' }
  ];
  const template = [
    { label: 'Fitxer', submenu: fileItems },
    { label: 'Edició', submenu: [
      item('Desfer', 'undo', 'CmdOrCtrl+Z'),
      item('Refer', 'redo', 'CmdOrCtrl+Y'),
      { type: 'separator' },
      item('Retallar', 'cut', 'CmdOrCtrl+X'),
      item('Copiar', 'copy', 'CmdOrCtrl+C'),
      item('Enganxar', 'paste', 'CmdOrCtrl+V'),
      item('Eliminar', 'delete', 'Delete'),
      { type: 'separator' },
      item('Seleccionar-ho tot', 'selectAll', 'CmdOrCtrl+A')
    ] },
    { label: 'Visualització', submenu: [
      item('Apropar', 'zoomIn', 'Ctrl+='),
      item('Allunyar', 'zoomOut', 'Ctrl+-'),
      item('Ajustar a la superfície', 'zoomFit', 'Ctrl+0')
    ] },
    { label: 'Maqueta', submenu: [
      item('Validar topologia', 'validateTopology'),
      item('Mesurar distància', 'measure')
    ] },
    { label: 'Vies', submenu: [
      item('Activar connexió manual de ports', 'portMode'),
      item('Crear vies paral·leles', 'createParallel'),
      item('Suggerir vies per als buits', 'suggestGaps')
    ] },
    { label: 'Digital i analògic', submenu: [
      item('Connectar amb JMRI (lectura)', 'connect'),
      item('Desconnectar de JMRI', 'disconnect')
    ] },
    { label: 'Ferrocarril', submenu: [
      item('Configurar sistema digital…', 'openCommandStation'),
      item('Estat de la connexió i de la central…', 'showDigitalStatus'),
      { type: 'separator' },
      { label: 'Aturar tots els trens (bloquejat fins a validació fail-safe)', enabled: false },
      { label: 'Finalitzar tots els horaris (gestor d’horaris pendent)', enabled: false },
      { label: 'Cancel·lar totes les rutes (interbloqueig pendent)', enabled: false },
      { type: 'separator' },
      { label: 'Activar alimentació de via (sortides físiques bloquejades)', enabled: false },
      { label: 'Desactivar alimentació de via (ordre física no habilitada)', enabled: false },
      { label: 'Aturar la maqueta (pendent de validació física)', enabled: false },
      { type: 'separator' },
      { label: 'Diagnòstic del sistema digital (només lectura)', click: () => send('showDigitalStatus') }
    ] },
    { label: 'Tren', submenu: [
      item('Nova locomotora…', 'trainNewEngine'),
      item('Nou vagó/cotxe…', 'trainNewCar'),
      item('Nova composició fixa…', 'trainNewTrainSet'),
      item('Nou tren…', 'trainNewTrain'),
      { type: 'separator' },
      item('Llista de trens', 'trainList'),
      item('Propietats…', 'trainProperties'),
      item('Perfil de velocitat…', 'trainSpeedProfile'),
      { type: 'separator' },
      { label: 'Adquirir control (bloquejat per seguretat)', enabled: false },
      { label: 'Alliberar control (bloquejat per seguretat)', enabled: false },
      { label: 'Aturar (ordre física bloquejada)', enabled: false },
      { label: 'Invertir sentit (ordre física bloquejada)', enabled: false },
      { label: 'Aturada d’emergència (requereix circuit físic independent)', enabled: false },
      { label: 'Funcions auxiliars F0–F32 (DCC bloquejat)', enabled: false },
      { type: 'separator' },
      item('Acoblar vagó…', 'trainCouple'),
      item('Desacoblar vagó…', 'trainUncouple'),
      item('Operacions de tren…', 'trainOperations'),
      { type: 'separator' },
      item('Activar/desactivar mode d’edició de trens', 'trainToggleEditMode'),
      item('Eliminar tren o vagó…', 'trainDelete')
    ] },
    { label: 'Despatxador', submenu: [
      item('Obrir el Dispatcher', 'dispatcherOpen'),
      item('Crear itinerari…', 'dispatcherCreateRoute')
    ] },
    { label: 'Trànsit', submenu: [
      item('Planificar circulació…', 'trafficPlan'),
      item('Llista de circulacions', 'trafficList'),
      { type: 'separator' },
      { label: 'Aturar totes les circulacions (bloquejat per seguretat)', enabled: false },
      { label: 'Emergència global DCC (sortides físiques bloquejades)', enabled: false }
    ] },
    { label: 'Horaris', submenu: [
      item('Obrir gestor d’horaris', 'scheduleOpen'),
      item('Crear horari…', 'scheduleCreate'),
      item('Llista d’horaris', 'scheduleList'),
      item('Gestionar successors d’horaris…', 'scheduleSuccessors')
    ] },
    { label: 'Operació', submenu: [
      { label: 'Macros', submenu: [item('Obrir Operació', 'operationOpen'), item('Crear macro…', 'operationMacroCreate')] },
      { label: 'Banderes', submenu: [item('Crear bandera…', 'operationFlagCreate')] },
      { label: 'Comptadors', submenu: [item('Crear comptador…', 'operationCounterCreate')] },
      { label: 'Esdeveniments programats', submenu: [item('Programar esdeveniment…', 'operationEventCreate'), item('Comprovar esdeveniments pendents', 'operationRefreshEvents')] }
    ] },
    { label: 'Finestres', submenu: [
      item('Mostrar totes les finestres', 'windowShowAll'),
      item('Minimitzar totes les finestres', 'windowMinimizeAll'),
      { type: 'separator' },
      item('Disposar en cascada', 'windowCascade'),
      item('Disposar en mosaic', 'windowTile'),
      item('Restaurar disposició inicial', 'windowRestoreLayout'),
      { type: 'separator' },
      item('Editor de maqueta', 'windowShowEditor'),
      item('Despatxador', 'windowShowDispatcher'),
      item('Gestió de circulacions', 'windowShowTraffic'),
      item('Horaris', 'windowShowSchedules'),
      item('Operació', 'windowShowOperation'),
      item('Metge Quiral', 'windowShowMetgeQuiral')
    ] },
    { label: 'Ajuda', submenu: [
      item('Guia ràpida', 'helpQuick'),
      item('Contingut de l’ajuda', 'helpContents'),
      item('Dreceres de teclat', 'helpShortcuts'),
      { type: 'separator' },
      item('Seguretat i diagnòstics del Metge Quiral', 'helpDiagnostics'),
      { type: 'separator' },
      item('Sobre JMRI TC Gold Custom', 'helpAbout')
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  // Classic mode uses the native Windows menu; modern mode uses the in-app ribbon.
  mainWindow?.setMenuBarVisibility(activeMode === 'classic');
}

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
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });
  mainWindow = window;
  window.setMenuBarVisibility(false);
  window.once('ready-to-show', () => window.show());
  await window.loadURL(`http://127.0.0.1:${port}`);
  window.on('closed', () => {
    mainWindow = null;
    if (app.quit) app.quit();
  });
}

app.whenReady().then(() => { installProjectHandlers(); installApplicationMenu('modern'); return createWindow(); }).catch(async error => {
  console.error(error);
  await dialog.showMessageBox({
    type: 'error', buttons: ['D’acord'],
    title: 'JMRI TC Gold Custom',
    message: 'No s’ha pogut iniciar el pont local.',
    detail: error.message
  });
  app.quit();
});

ipcMain.on('ui:mode', (_event, mode) => installApplicationMenu(mode));

app.on('before-quit', () => {
  quitting = true;
  if (bridge && !bridge.killed) bridge.kill();
});

app.on('window-all-closed', () => app.quit());
