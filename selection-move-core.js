(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.JMRI_TC_SELECTION_MOVE = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  function finite(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError(label + ' ha de ser un nombre finit.');
    return number;
  }
  function snap(value, grid) { return Math.round(value / grid) * grid; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function createDrag(pieces, anchorId, pointer, board, grid) {
    grid = grid === undefined ? 10 : finite(grid, 'La graella');
    if (!Array.isArray(pieces) || pieces.length === 0) throw new TypeError('Cal seleccionar almenys una peça.');
    if (!(grid > 0)) throw new RangeError('La graella ha de ser positiva.');
    const width = finite(board && board.width, 'L’amplada del tauler');
    const height = finite(board && board.height, 'L’alçada del tauler');
    if (!(width > 0 && height > 0)) throw new RangeError('Les dimensions del tauler han de ser positives.');
    const pointerStart = {
      x: finite(pointer && pointer.x, 'La coordenada X del cursor'),
      y: finite(pointer && pointer.y, 'La coordenada Y del cursor')
    };
    const seen = new Set();
    const originals = pieces.map(piece => {
      if (!piece || piece.id === undefined || piece.id === null) throw new TypeError('Cada peça ha de tenir un identificador.');
      const id = String(piece.id);
      if (seen.has(id)) throw new Error('La selecció conté identificadors duplicats: ' + id);
      seen.add(id);
      return { id, x: finite(piece.x, 'La coordenada X de ' + id), y: finite(piece.y, 'La coordenada Y de ' + id) };
    });
    const anchor = originals.find(piece => piece.id === String(anchorId));
    if (!anchor) throw new Error('La peça d’ancoratge no forma part de la selecció.');
    const bounds = originals.reduce((box, piece) => ({
      minX: Math.min(box.minX, piece.x), minY: Math.min(box.minY, piece.y),
      maxX: Math.max(box.maxX, piece.x), maxY: Math.max(box.maxY, piece.y)
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    if (bounds.minX < 0 || bounds.minY < 0 || bounds.maxX > width || bounds.maxY > height) {
      throw new RangeError('La selecció conté peces fora de la superfície del tauler.');
    }
    return { anchorId: anchor.id, pointerStart, originals, bounds, board: { width, height }, grid };
  }

  function move(drag, pointer) {
    if (!drag || !Array.isArray(drag.originals) || !drag.originals.length) throw new TypeError('Estat de moviment invàlid.');
    const x = finite(pointer && pointer.x, 'La coordenada X del cursor');
    const y = finite(pointer && pointer.y, 'La coordenada Y del cursor');
    const rawDx = snap(x - drag.pointerStart.x, drag.grid);
    const rawDy = snap(y - drag.pointerStart.y, drag.grid);
    const epsilon = 1e-9;
    const minDx = Math.ceil((-drag.bounds.minX - epsilon) / drag.grid) * drag.grid;
    const maxDx = Math.floor((drag.board.width - drag.bounds.maxX + epsilon) / drag.grid) * drag.grid;
    const minDy = Math.ceil((-drag.bounds.minY - epsilon) / drag.grid) * drag.grid;
    const maxDy = Math.floor((drag.board.height - drag.bounds.maxY + epsilon) / drag.grid) * drag.grid;
    if (minDx > maxDx || minDy > maxDy) throw new RangeError('La selecció no cap dins de la superfície del tauler.');
    const dx = clamp(rawDx, minDx, maxDx);
    const dy = clamp(rawDy, minDy, maxDy);
    return { dx, dy, positions: drag.originals.map(piece => ({ id: piece.id, x: piece.x + dx, y: piece.y + dy })) };
  }
  function rotate(pieces, angleDeg, board) {
    if (!Array.isArray(pieces) || pieces.length === 0) throw new TypeError('Cal seleccionar almenys una peça.');
    const angle = finite(angleDeg, 'L’angle de rotació');
    const width = finite(board && board.width, 'L’amplada del tauler');
    const height = finite(board && board.height, 'L’alçada del tauler');
    if (!(width > 0 && height > 0)) throw new RangeError('Les dimensions del tauler han de ser positives.');
    const seen = new Set();
    const originals = pieces.map(piece => {
      if (!piece || piece.id === undefined || piece.id === null) throw new TypeError('Cada peça ha de tenir un identificador.');
      const id = String(piece.id);
      if (seen.has(id)) throw new Error('La selecció conté identificadors duplicats: ' + id);
      seen.add(id);
      return {
        id,
        x: finite(piece.x, 'La coordenada X de ' + id),
        y: finite(piece.y, 'La coordenada Y de ' + id),
        rotation: finite(piece.rotation === undefined ? 0 : piece.rotation, 'La rotació de ' + id)
      };
    });
    const bounds = originals.reduce((box, piece) => ({
      minX: Math.min(box.minX, piece.x), minY: Math.min(box.minY, piece.y),
      maxX: Math.max(box.maxX, piece.x), maxY: Math.max(box.maxY, piece.y)
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    const radians = angle * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
    const epsilon = 1e-7;
    const positions = originals.map(piece => {
      let x = center.x + (piece.x - center.x) * c - (piece.y - center.y) * s;
      let y = center.y + (piece.x - center.x) * s + (piece.y - center.y) * c;
      if (x < -epsilon || y < -epsilon || x > width + epsilon || y > height + epsilon) {
        throw new RangeError('La rotació deixaria una peça fora de la superfície del tauler.');
      }
      if (Math.abs(x) < epsilon) x = 0;
      if (Math.abs(y) < epsilon) y = 0;
      if (Math.abs(x - width) < epsilon) x = width;
      if (Math.abs(y - height) < epsilon) y = height;
      return { id: piece.id, x, y, rotation: ((piece.rotation + angle) % 360 + 360) % 360 };
    });
    return { angle, center, positions };
  }
  return Object.freeze({ createDrag, move, rotate });
});
