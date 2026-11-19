'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { clampBounds, WINDOW_TYPES } = require('../electron/multimonitor.cjs');

const display = { bounds: { x: 1920, y: 0, width: 3840, height: 2160 }, workArea: { x: 1920, y: 0, width: 3840, height: 2100 } };
assert.deepEqual(clampBounds({ x: 9000, y: -20, width: 5000, height: 3000 }, display), {
  x: 1920, y: 0, width: 3840, height: 2100
});
assert.deepEqual(clampBounds({ x: 2200, y: 200, width: 1000, height: 700 }, display), {
  x: 2200, y: 200, width: 1000, height: 700
});
assert.equal(Object.keys(WINDOW_TYPES).length, 6);
assert.equal(WINDOW_TYPES.dispatcher, 'Despatxador');
assert.equal(WINDOW_TYPES.diagnostics, 'Metge Quiral');

console.log('PASS: multi-monitor window bounds are constrained to the selected display and window types are whitelisted.');
