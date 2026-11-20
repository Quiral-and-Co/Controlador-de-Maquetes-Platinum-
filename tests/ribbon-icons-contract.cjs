'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
const commands = [...new Set([...html.matchAll(/data-ribbon-command="([^"]+)"/g)].map(match => match[1]))];
assert.equal(commands.length, 78, 'Update this contract when the ribbon command inventory changes.');
commands.push('unmappedCommand'); // The fallback must also be safe for future commands.

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
assert.doesNotThrow(() => vm.runInNewContext(source, { document }), 'every ribbon command must initialize without throwing');
for (const button of buttons) {
  assert.equal(button.dataset.iconized, 'true', button.dataset.ribbonCommand);
  assert.equal(button.attributes['aria-label'], button.textContent);
  assert.equal(button.attributes['data-tooltip'], button.textContent);
  assert.equal(button.title, button.textContent);
  const svg = button.children[0];
  assert.equal(svg.tag, 'svg');
  assert.equal(svg.children.length, 2);
  assert.ok(svg.children[1].attributes.d, 'every command must receive a non-empty SVG path: ' + button.dataset.ribbonCommand);
}
console.log('OK: ' + (commands.length - 1) + ' ordres reals de la cinta i el fallback tenen icones SVG vàlides i etiquetes accessibles.');
