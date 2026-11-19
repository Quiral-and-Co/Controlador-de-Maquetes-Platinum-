'use strict';

const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const WINDOW_TYPES = Object.freeze({
  editor: 'Editor de maqueta',
  switchboard: 'Panell d’accessoris (Switchboard)',
  keyboard: 'Teclat d’accessoris (Keyboard)',
  trainWindow: 'Finestra del tren (Train Window)',
  trainDetector: 'Detecció d’ocupació (Train Detector)',
  levels: 'Gestió de nivells',
  catalogue: 'Catàleg de vies',
  properties: 'Propietats i geometria XYZ',
  dispatcher: 'Despatxador',
  routes: 'Itineraris i blocs',
  traffic: 'Trànsit i circulacions',
  schedules: 'Horaris',
  operation: 'Operació',
  commandStation: 'Central digital',
  locomotiveDmi: 'DMI de locomotora',
  trainProtection: 'Protecció del tren',
  trainGround: 'Terminal tren-terra',
  spielewelt: 'Món de Jocs',
  signalling: 'Senyalització',
  validation: 'Validació i seguretat',
  diagnostics: 'Metge Quiral',
  desktopPanel: 'Panell desacoblat'
});
const MAX_STATE_BYTES = 2 * 1024 * 1024;
const DEFAULT_BOUNDS = Object.freeze({ width: 1100, height: 760 });
const MAIN_WINDOW_KEY = '__main__';

function setAlwaysOnTop(sender, enabled) {
  if (!sender || sender.isDestroyed?.()) throw new Error('La finestra activa no està disponible.');
  const next = typeof enabled === 'boolean' ? enabled : !sender.isAlwaysOnTop();
  sender.setAlwaysOnTop(next);
  return sender.isAlwaysOnTop();
}

function clampBounds(bounds, display) {
  const area = display.workArea || display.bounds;
  const width = Math.max(640, Math.min(Number(bounds.width) || DEFAULT_BOUNDS.width, area.width));
  const height = Math.max(480, Math.min(Number(bounds.height) || DEFAULT_BOUNDS.height, area.height));
  const x = Math.max(area.x, Math.min(Number(bounds.x) || area.x, area.x + area.width - width));
  const y = Math.max(area.y, Math.min(Number(bounds.y) || area.y, area.y + area.height - height));
  return { x, y, width, height };
}

function installMultiMonitor({ app, BrowserWindow, screen, ipcMain, getMainWindow, getPort }) {
  const windows = new Map();
  const statePath = path.join(app.getPath('userData'), 'native-window-layout.json');
  let saved = {};
  let state = null;
  const layoutReady = fs.readFile(statePath, 'utf8').then(content => {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed;
  }).catch(() => {});

  const displays = () => screen.getAllDisplays();
  const displayFor = id => displays().find(item => String(item.id) === String(id)) || screen.getPrimaryDisplay();
  const allWindows = () => [getMainWindow(), ...windows.values()].filter(win => win && !win.isDestroyed());
  const broadcast = (channel, payload) => allWindows().forEach(win => {
    if (!win.webContents.isDestroyed()) win.webContents.send(channel, payload);
  });
  const persist = async () => {
    await layoutReady;
    const layout = {};
    const main = getMainWindow();
    if (main && !main.isDestroyed()) {
      const bounds = main.getBounds();
      const display = screen.getDisplayMatching ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay();
      layout[MAIN_WINDOW_KEY] = { bounds, displayId: main.__displayId || String(display.id), type: 'main' };
    }
    for (const [id, win] of windows) {
      if (!win.isDestroyed()) layout[id] = { bounds: win.getBounds(), displayId: win.__displayId, type: win.__windowType };
    }
    saved = { ...saved, ...layout };
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    const temp = statePath + '.tmp';
    await fs.writeFile(temp, JSON.stringify(saved, null, 2), 'utf8');
    await fs.rename(temp, statePath);
  };
  const safePersist = () => { persist().catch(error => console.error('[Finestres natives] No s’ha pogut desar la disposició:', error)); };
  const mainAtInstall = getMainWindow();
  if (mainAtInstall) {
    const initialDisplay = screen.getDisplayMatching ? screen.getDisplayMatching(mainAtInstall.getBounds()) : screen.getPrimaryDisplay();
    mainAtInstall.__displayId = String(initialDisplay.id);
    const trackMainBounds = () => {
      const matching = screen.getDisplayMatching ? screen.getDisplayMatching(mainAtInstall.getBounds()) : screen.getPrimaryDisplay();
      mainAtInstall.__displayId = String(matching.id);
      safePersist();
    };
    mainAtInstall.on('move', trackMainBounds);
    mainAtInstall.on('resize', trackMainBounds);
  }

  async function restoreMainWindow() {
    await layoutReady;
    const main = getMainWindow();
    const mainState = saved[MAIN_WINDOW_KEY];
    if (!main || main.isDestroyed() || !mainState?.bounds) return false;
    const target = displayFor(mainState.displayId);
    main.setBounds(clampBounds(mainState.bounds, target));
    main.__displayId = String(target.id);
    return true;
  }

  async function openWindow(options = {}) {
    await layoutReady;
    const type = typeof options.type === 'string' ? options.type : '';
    if (!Object.hasOwn(WINDOW_TYPES, type)) throw new TypeError('Tipus de finestra no permès.');
    const panelKey = type === 'desktopPanel' ? String(options.panelKey || '') : '';
    if (type === 'desktopPanel' && !/^[a-z0-9_-]{1,80}$/.test(panelKey)) throw new TypeError('Identificador de panell no vàlid.');
    const duplicate = options.duplicate === true;
    const id = type === 'desktopPanel' ? `desktop-panel-${panelKey}` : duplicate ? `${type}-${randomUUID()}` : type;
    const existing = windows.get(id);
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return { id, reused: true };
    }

    const savedWindow = saved[id] || {};
    const target = displayFor(options.displayId ?? savedWindow.displayId);
    const candidate = options.bounds && typeof options.bounds === 'object' ? options.bounds : savedWindow.bounds || {};
    const bounds = clampBounds(candidate, target);
    const win = new BrowserWindow({
      ...bounds,
      minWidth: 640,
      minHeight: 480,
      show: false,
      autoHideMenuBar: true,
      frame: true,
      resizable: true,
      minimizable: true,
      maximizable: true,
      fullscreenable: true,
      title: type === 'desktopPanel' && typeof options.title === 'string' ? options.title.slice(0, 80) || WINDOW_TYPES[type] : WINDOW_TYPES[type],
      backgroundColor: '#101b28',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, 'preload.cjs')
      }
    });
    win.__windowType = type;
    win.__displayId = String(target.id);
    windows.set(id, win);
    win.once('ready-to-show', () => { if (!win.isDestroyed()) win.show(); });
    win.on('move', safePersist);
    win.on('resize', safePersist);
    win.on('closed', () => { windows.delete(id); broadcast('workspace:window-closed', { id, type, panelKey }); safePersist(); });
    const url = new URL(`http://127.0.0.1:${getPort()}/`);
    url.searchParams.set('nativeWindow', type);
    url.searchParams.set('nativeWindowId', id);
    if (type === 'desktopPanel') url.searchParams.set('nativePanel', panelKey);
    await win.loadURL(url.toString());
    broadcast('workspace:window-opened', { id, type, title: WINDOW_TYPES[type], displayId: String(target.id) });
    return { id, reused: false, displayId: String(target.id) };
  }

  ipcMain.handle('native-window:toggle-always-on-top', (event, enabled) => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    if (!sender || !allWindows().includes(sender)) throw new Error('Emissor de finestra no autoritzat.');
    return setAlwaysOnTop(sender, enabled);
  });
  ipcMain.handle('native-window:is-always-on-top', event => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    if (!sender || !allWindows().includes(sender)) throw new Error('Emissor de finestra no autoritzat.');
    return sender.isAlwaysOnTop();
  });
  ipcMain.handle('native-window:list', () => [...windows.entries()].filter(([, win]) => !win.isDestroyed()).map(([id, win]) => ({
    id, type: win.__windowType, title: WINDOW_TYPES[win.__windowType], bounds: win.getBounds(),
    displayId: win.__displayId, visible: win.isVisible()
  })));
  ipcMain.handle('native-window:displays', () => displays().map(display => ({
    id: String(display.id), label: display.label || `Pantalla ${display.id}`,
    bounds: display.bounds, workArea: display.workArea, scaleFactor: display.scaleFactor,
    primary: display.id === screen.getPrimaryDisplay().id
  })));
  ipcMain.handle('native-window:open', (_event, options) => openWindow(options));
  ipcMain.handle('native-window:close', (_event, id) => {
    const win = windows.get(id);
    if (!win || win.isDestroyed()) return false;
    win.close();
    return true;
  });
  ipcMain.handle('native-window:move', async (_event, options = {}) => {
    const win = windows.get(options.id);
    if (!win || win.isDestroyed()) throw new Error('La finestra nativa no existeix.');
    const display = displayFor(options.displayId);
    const bounds = clampBounds(options.bounds || win.getBounds(), display);
    win.setBounds(bounds);
    win.__displayId = String(display.id);
    win.show();
    win.focus();
    await persist();
    return { id: options.id, bounds, displayId: String(display.id) };
  });
  ipcMain.handle('native-window:show-all', () => {
    windows.forEach(win => { if (!win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.show(); } });
    return windows.size;
  });
  ipcMain.handle('native-window:get-state', event => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    if (!sender || !allWindows().includes(sender)) throw new Error('Emissor de finestra no autoritzat.');
    return state;
  });
  ipcMain.handle('native-window:publish-state', (event, payload) => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    if (!sender || !allWindows().includes(sender)) throw new Error('Emissor de finestra no autoritzat.');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('L’estat compartit ha de ser un objecte JSON.');
    const serialized = JSON.stringify(payload);
    if (typeof serialized !== 'string') throw new TypeError('L’estat compartit no és serialitzable.');
    if (Buffer.byteLength(serialized, 'utf8') > MAX_STATE_BYTES) throw new Error('L’estat compartit supera els 2 MB.');
    state = payload;
    broadcast('workspace:state', payload);
    return true;
  });

  screen.on('display-removed', () => {
    const available = displays();
    if (!available.length) return;
    const main = getMainWindow();
    if (main && !main.isDestroyed()) {
      const mainBounds = main.getBounds();
      if (!available.some(display => String(display.id) === String(main.__displayId))) {
        const target = screen.getPrimaryDisplay();
        main.setBounds(clampBounds(mainBounds, target));
        main.__displayId = String(target.id);
      }
    }
    for (const win of windows.values()) {
      if (win.isDestroyed()) continue;
      if (!available.some(display => String(display.id) === win.__displayId)) {
        const target = screen.getPrimaryDisplay();
        win.setBounds(clampBounds(win.getBounds(), target));
        win.__displayId = String(target.id);
        win.show();
      }
    }
    safePersist();
    broadcast('workspace:displays-changed', available.map(display => ({ id: String(display.id), bounds: display.bounds })));
  });
  screen.on('display-added', () => broadcast('workspace:displays-changed', displays().map(display => ({ id: String(display.id), bounds: display.bounds }))));
  app.on('before-quit', safePersist);

  return Object.freeze({
    openWindow,
    restoreMainWindow,
    persist,
    getState: () => state,
    getWindowTypes: () => ({ ...WINDOW_TYPES })
  });
}

module.exports = { installMultiMonitor, clampBounds, setAlwaysOnTop, WINDOW_TYPES };
