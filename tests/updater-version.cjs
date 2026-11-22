'use strict';
const assert = require('node:assert/strict');
const { compareVersions, checkLatestRelease } = require('../electron/update-checker.cjs');

assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
assert.equal(compareVersions('v2.0.0', '2.0.0'), 0);
assert.equal(compareVersions('2.0.0-beta.2', '2.0.0-beta.10'), -1);
assert.equal(compareVersions('2.0.0', '2.0.0-rc.1'), 1);
assert.equal(compareVersions('1.4.1', '2.0.0'), -1);
assert.throws(() => compareVersions('latest', '2.0.0'), /no vàlida/);

(async () => {
  const noRelease = await checkLatestRelease({
    currentVersion: '2.0.0',
    fetchImpl: async () => ({ status: 404 })
  });
  assert.equal(noRelease.noRelease, true);
  const update = await checkLatestRelease({
    currentVersion: '2.0.0',
    fetchImpl: async () => ({
      status: 200, ok: true,
      json: async () => ({
        tag_name: 'v2.1.0',
        name: 'Versió 2.1.0',
        html_url: 'https://github.com/Quiral-and-Co/Controlador-de-Maquetes-Platinum-/releases/tag/v2.1.0'
      })
    })
  });
  assert.equal(update.updateAvailable, true);
  assert.equal(update.latestVersion, '2.1.0');
  console.log('Updater version tests: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
