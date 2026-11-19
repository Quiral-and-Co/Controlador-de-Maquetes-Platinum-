'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { clampBounds, setAlwaysOnTop, WINDOW_TYPES } = require('../electron/multimonitor.cjs');

const display = { bounds: { x: 1920, y: 0, width: 3840, height: 2160 }, workArea: { x: 1920, y: 0, width: 3840, height: 2100 } };
assert.deepEqual(clampBounds({ x: 9000, y: -20, width: 5000, height: 3000 }, display), {
  x: 1920, y: 0, width: 3840, height: 2100
});
assert.deepEqual(clampBounds({ x: 2200, y: 200, width: 1000, height: 700 }, display), {
  x: 2200, y: 200, width: 1000, height: 700
});
assert.equal(Object.keys(WINDOW_TYPES).length, 22);
for (const type of ['switchboard','keyboard','trainWindow','trainDetector','levels', 'catalogue', 'properties', 'routes', 'commandStation', 'locomotiveDmi', 'trainProtection', 'trainGround', 'spielewelt', 'signalling', 'validation']) assert.ok(Object.hasOwn(WINDOW_TYPES, type), `Falta la finestra ${type}`);
assert.equal(WINDOW_TYPES.trainDetector, 'Detecció d’ocupació (Train Detector)');
assert.equal(WINDOW_TYPES.dispatcher, 'Despatxador');
assert.equal(WINDOW_TYPES.diagnostics, 'Metge Quiral');

const pinTarget = {
  pinned: false,
  isDestroyed: () => false,
  isAlwaysOnTop() { return this.pinned; },
  setAlwaysOnTop(value) { this.pinned = value; }
};
assert.equal(setAlwaysOnTop(pinTarget, true), true);
assert.equal(setAlwaysOnTop(pinTarget), false);
assert.equal(setAlwaysOnTop(pinTarget), true);
assert.throws(() => setAlwaysOnTop({ isDestroyed: () => true }), /no està disponible/);

(async () => {
  const { EventEmitter } = require('node:events');
  const { installMultiMonitor } = require('../electron/multimonitor.cjs');
  const handlers = new Map();
  const ipcMain = { handle: (name, callback) => handlers.set(name, callback) };
  const app = new EventEmitter();
  app.getPath = () => require('node:os').tmpdir();
  const screen = new EventEmitter();
  const displayInfo = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
  screen.getAllDisplays = () => [displayInfo];
  screen.getPrimaryDisplay = () => displayInfo;
  screen.getDisplayMatching = () => displayInfo;
  const instances = [];
  class MockWindow extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.bounds = { x: options.x || 0, y: options.y || 0, width: options.width, height: options.height };
      this.webContents = { isDestroyed: () => false, send() {} }; this.destroyed = false; this.pinned = false; instances.push(this);
    }
    static fromWebContents(contents) { return instances.find(win => win.webContents === contents) || null; }
    isDestroyed() { return this.destroyed; }
    isMinimized() { return false; }
    isVisible() { return true; }
    getBounds() { return this.bounds; }
    setBounds(bounds) { this.bounds = bounds; }
    setAlwaysOnTop(value) { this.pinned = value; }
    isAlwaysOnTop() { return this.pinned; }
    show() {}
    focus() {}
    async loadURL(url) { this.loadedUrl = url; this.emit('ready-to-show'); }
    close() { this.destroyed = true; this.emit('closed'); }
  }
  const main = new MockWindow({ width: 1500, height: 950 });
  const manager = installMultiMonitor({ app, BrowserWindow: MockWindow, screen, ipcMain, getMainWindow: () => main, getPort: () => 12080 });
  await manager.restoreMainWindow();
  const opened = await handlers.get('native-window:open')({ sender: main.webContents }, { type: 'editor' });
  assert.equal(opened.id, 'editor');
  const child = instances[1];
  for (const flag of ['frame', 'resizable', 'minimizable', 'maximizable', 'fullscreenable']) assert.equal(child.options[flag], true, 'La finestra nativa ha de tenir ' + flag + '=true');
  assert.equal(handlers.get('native-window:toggle-always-on-top')({ sender: child.webContents }), true);
  assert.equal(child.isAlwaysOnTop(), true);
  assert.equal(handlers.get('native-window:is-always-on-top')({ sender: child.webContents }), true);
  const detached = await handlers.get('native-window:open')({ sender: main.webContents }, { type: 'desktopPanel', panelKey: 'track-area', title: 'Tauler de disseny' });
  assert.equal(detached.id, 'desktop-panel-track-area');
  const detachedWindow = instances[2];
  assert.equal(detachedWindow.options.title, 'Tauler de disseny');
  const detachedUrl = new URL(detachedWindow.loadedUrl);
  assert.equal(detachedUrl.searchParams.get('nativePanel'), 'track-area');
  assert.equal(detachedUrl.searchParams.get('nativeWindowId'), 'desktop-panel-track-area');
  await assert.rejects(() => handlers.get('native-window:open')({ sender: main.webContents }, { type: 'desktopPanel', panelKey: '../app.js' }), /Identificador de panell no vàlid/);
  const sharedState = { kind: 'app-state', sourceId: 'main', baseRevision: 0, config: { levels: [] } };
  assert.deepEqual(handlers.get('native-window:publish-state')({ sender: main.webContents }, sharedState), { ok: true, revision: 1 });
  const snapshot = handlers.get('native-window:get-state')({ sender: detachedWindow.webContents });
  assert.deepEqual(snapshot, { state: { ...sharedState, revision: 1 }, revision: 1 });
  const staleWrite = handlers.get('native-window:publish-state')({ sender: detachedWindow.webContents }, {
    kind: 'app-state', sourceId: 'desktop-panel-track-area', baseRevision: 0, config: { levels: [{ id: 99 }] }
  });
  assert.equal(staleWrite.ok, false);
  assert.equal(staleWrite.conflict, true);
  assert.equal(staleWrite.revision, 1);
  assert.deepEqual(staleWrite.state.config, { levels: [] });
  assert.throws(() => handlers.get('native-window:publish-state')({ sender: detachedWindow.webContents }, {
    kind: 'app-state', sourceId: 'main', baseRevision: 1, config: { levels: [] }
  }), /en nom d’un altre emissor/);
  assert.deepEqual(handlers.get('native-window:publish-state')({ sender: detachedWindow.webContents }, {
    kind: 'app-state', sourceId: 'desktop-panel-track-area', baseRevision: 1, config: { levels: [{ id: 2 }] }
  }), { ok: true, revision: 2 });
  const unauthorized = { isDestroyed: () => false, webContents: { isDestroyed: () => false } };
  assert.throws(() => handlers.get('native-window:toggle-always-on-top')({ sender: unauthorized.webContents }), /no autoritzat/);
  console.log('PASS: native windows retain Windows Snap-compatible frames, resize/minimize/maximize, and per-window always-on-top is sender-authorized.');
})().catch(error => { console.error(error); process.exitCode = 1; });

console.log('PASS: multi-monitor window bounds are constrained to the selected display and window types are whitelisted.');
