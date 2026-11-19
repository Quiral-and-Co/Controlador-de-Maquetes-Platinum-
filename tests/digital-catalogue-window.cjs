'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('index.html', 'utf8');
const manager = fs.readFileSync('desktop-window-manager.js', 'utf8');
const digitalUi = fs.readFileSync('protocol-catalogue-ui.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
const catalogue = JSON.parse(fs.readFileSync('catalogue-marklin-c.json', 'utf8'));

assert.match(index, /versió 1\.4\.0/i, 'La capçalera ha de mostrar la versió del paquet');
assert.doesNotMatch(index, /1\.2\s*alpha/i, 'No ha de quedar cap etiqueta 1.2 Alpha');
assert.match(manager, /registerPanel\(node, title/, 'El gestor ha de permetre registrar panells dinàmics');
assert.match(manager, /digital-catalogue/, 'La base de dades digital ha de tenir posició inicial pròpia');
assert.match(digitalUi, /JMRI_TC_DESKTOP\?\.registerPanel/, 'La UI digital ha de registrar-se al gestor de finestres');

assert.equal(catalogue.items.length, 68, 'La biblioteca Märklin C ha de tenir les 68 referències declarades');
const refs = catalogue.items.map(item => item.ref);
assert.equal(new Set(refs).size, refs.length, 'Les referències Märklin no poden estar duplicades');
for (const item of catalogue.items) {
  assert.ok(['confirmed', 'partial', 'unverified'].includes(item.geometryStatus), `Estat geomètric invàlid a ${item.ref}`);
}
console.log('Digital catalogue window and Märklin C catalogue contract: OK');
