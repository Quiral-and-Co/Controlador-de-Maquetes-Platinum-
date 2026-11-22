'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const commands = [
  'windowShowAll','windowMinimizeAll','windowCascade','windowTile',
  'windowTileTwoColumns','windowTileColumns','windowDockLeft','windowDockRight',
  'windowDockTop','windowDockBottom','windowRestoreLayout','windowShowEditor',
  'windowShowDispatcher','windowShowTraffic','windowShowSchedules',
  'windowShowOperation','windowShowMetgeQuiral'
];
const buttons = commands.map(command => ({
  textContent: command, disabled: false, dataset: { ribbonCommand: command },
  attributes: {}, children: [], classList: { add(name) { this[name] = true; } },
  setAttribute(name, value) { this.attributes[name] = value; },
  replaceChildren(...children) { this.children = children; }
}));
const document = {
  querySelectorAll(selector) {
    assert.equal(selector, '#modernRibbon [data-ribbon-command]');
    return buttons;
  },
  createElementNS(_namespace, tag) {
    return {
      tag, attributes: {}, children: [], classList: { add(name) { this[name] = true; } },
      setAttribute(name, value) { this.attributes[name] = value; },
      append(...children) { this.children.push(...children); }
    };
  }
};
const source = fs.readFileSync(require.resolve('../ribbon-icons.js'), 'utf8');
vm.runInNewContext(source, { document });
const signatures = buttons.map(button => {
  assert.equal(button.dataset.iconized, 'true', button.dataset.ribbonCommand);
  assert.equal(button.attributes['aria-label'], button.textContent);
  assert.equal(button.attributes['data-tooltip'], button.textContent);
  const svg = button.children[0];
  assert.equal(svg.tag, 'svg');
  return svg.children[1].attributes.d;
});
assert.equal(new Set(signatures).size, commands.length, 'Cada ordre de la pestanya Finestra ha de tenir una icona diferenciada.');
console.log('OK: 17 ordres de Finestra tenen icones SVG diferenciades i etiquetes accessibles.');
