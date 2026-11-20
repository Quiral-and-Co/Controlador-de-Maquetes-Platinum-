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
assert.match(manager, /function bringToFront\(win\)/, 'en activar una finestra ha de passar per davant de les altres');
assert.doesNotMatch(styles, /body\.mode-modern \.desktop-window\s*\{[^}]*z-index\s*:\s*auto\s*!important/i, 'El CSS no pot anul·lar la prioritat de les finestres');
assert.match(digitalUi, /JMRI_TC_DESKTOP\?\.registerPanel/, 'La UI digital ha de registrar-se al gestor de finestres');
assert.match(digitalUi, /\.digital-list\{overflow:visible\}/, 'Les taules del catàleg no poden crear un segon scroll vertical');

assert.match(manager, /18 \+ offset \* 24/, 'Els panells no poden quedar aparcats sota la zona visible');
assert.doesNotMatch(manager, /680 \+ Math\.floor\(index \/ 2\) \* 540/, 'No s’han de crear panells a centenars de píxels sota la vista');
assert.match(styles, /body\.mode-modern\{height:100dvh;min-height:0;overflow:hidden/, 'El mode modern ha de bloquejar el scroll del document');
assert.match(styles, /body\.mode-modern \.desktop-workspace\{flex:1 1 auto;height:auto;min-height:220px/, 'El scroll principal ha de quedar dins l’espai de treball');

assert.equal(catalogue.items.length, 68, 'La biblioteca Märklin C ha de tenir les 68 referències declarades');
const refs = catalogue.items.map(item => item.ref);
assert.equal(new Set(refs).size, refs.length, 'Les referències Märklin no poden estar duplicades');
for (const item of catalogue.items) {
  assert.ok(['confirmed', 'partial', 'unverified'].includes(item.geometryStatus), `Estat geomètric invàlid a ${item.ref}`);
}

const scrollContract = styles.slice(styles.lastIndexOf('/* Final scroll ownership contract'));
assert.ok(scrollContract.length > 0, 'Cal un contracte final explícit de propietat del scroll');
assert.match(scrollContract, /body\.mode-modern \.desktop-workspace\s*\{[^}]*overflow:\s*hidden\s*!important/s, 'L’escriptori no pot tenir un segon scroll');
assert.match(scrollContract, /body\.mode-modern \.desktop-window-content\s*\{[^}]*overflow:\s*hidden\s*!important/s, 'El contenidor de finestra no pot afegir un segon scroll');
assert.match(scrollContract, /desktop-window-content > \.editor-sidebar[\s\S]*?overflow:\s*auto\s*!important/, 'El panell lateral ha de conservar el seu scroll intern únic');
assert.match(scrollContract, /desktop-window-content > \.track-area \.canvas-wrap[\s\S]*?overflow:\s*auto\s*!important/, 'El tauler ha de conservar el scroll intern del llenç');
assert.match(scrollContract, /body\.mode-modern\s*\{[^}]*overflow:\s*hidden\s*!important/s, 'El document no pot desplaçar-se en mode modern, tampoc en pantalles estretes');

console.log('Digital catalogue window and Märklin C catalogue contract: OK');
