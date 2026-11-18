'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('app.js', 'utf8');
const main = fs.readFileSync('electron/main.cjs', 'utf8');
const preload = fs.readFileSync('electron/preload.cjs', 'utf8');

assert.match(app, /mode:'modern'/, 'modern interface must be the default');
const modeStart = app.indexOf('function setMode(');
const modeEnd = app.indexOf('window.JMRI_TC_DISPATCHER =', modeStart);
assert.ok(modeStart >= 0 && modeEnd > modeStart, 'mode switch implementation must exist');
const modeSource = app.slice(modeStart, modeEnd);
assert.match(modeSource, /document\.body\?\.classList\?\.toggle\('mode-modern'/);
assert.match(modeSource, /setUiMode\?\.\(next\)/);
assert.doesNotMatch(modeSource, /state\.config\s*=|state\.selectedIds\s*=|state\.selectedLevel\s*=/,
  'switching interface mode must not replace project, selection or active level');
assert.match(preload, /setUiMode:\s*mode\s*=>/);
assert.match(main, /autoHideMenuBar:\s*false/);
assert.match(main, /Menús clàssics/);
assert.match(main, /Menús moderns/);
assert.match(main, /ipcMain\.on\('ui:mode'/);
assert.match(main, /JMRI_TC_ENABLE_DCC:\s*'0'/);
assert.match(main, /JMRI_TC_SAFETY_VALIDATED:\s*'0'/);
console.log('PASS Windows UI mode contract and fail-safe defaults');

assert.match(app, /JMRI_TC_DESKTOP\\?\\.setMode/);
const manager = fs.readFileSync('desktop-window-manager.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
assert.match(manager, /desktop-window-titlebar/);
assert.match(manager, /desktop-taskbar/);
assert.match(styles, /resize:both/);
assert.match(manager, /pointermove/);
assert.match(manager, /leaveModern/);
assert.match(manager, /Tauler de disseny de la maqueta/);
console.log('PASS floating modern desktop windows, taskbar and classic restore contract');
