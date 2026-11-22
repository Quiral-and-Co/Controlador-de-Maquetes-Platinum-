'use strict';

function parseVersion(value) {
  const normalized = String(value ?? '').trim().replace(/^v/i, '').split('+', 1)[0];
  const match = normalized.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) throw new TypeError(`Versió semàntica no vàlida: ${value}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ? match[4].split('.') : [] };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  if (!a.prerelease.length && !b.prerelease.length) return 0;
  if (!a.prerelease.length) return 1;
  if (!b.prerelease.length) return -1;
  const count = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < count; i += 1) {
    const x = a.prerelease[i], y = b.prerelease[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
    if (xn && yn) return Number(x) > Number(y) ? 1 : -1;
    if (xn !== yn) return xn ? -1 : 1;
    return x > y ? 1 : -1;
  }
  return 0;
}

async function checkLatestRelease({ currentVersion, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== 'function') throw new Error('Aquest entorn no permet consultar GitHub.');
  const response = await fetchImpl('https://api.github.com/repos/Quiral-and-Co/Controlador-de-Maquetes-Platinum-/releases/latest', {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Quiral-Platinum-Updater' },
    signal: AbortSignal.timeout(12000)
  });
  if (response.status === 404) {
    return { currentVersion, latestVersion: null, updateAvailable: false, releaseUrl: null, releaseName: null, noRelease: true };
  }
  if (!response.ok) throw new Error(`GitHub ha respost amb HTTP ${response.status}.`);
  const release = await response.json();
  const tag = String(release.tag_name ?? '').trim();
  const latestVersion = tag.replace(/^v/i, '');
  const releaseUrl = String(release.html_url ?? '');
  if (!tag || !releaseUrl.startsWith('https://github.com/Quiral-and-Co/Controlador-de-Maquetes-Platinum-/releases/')) {
    throw new Error('La Release de GitHub no conté una versió o un enllaç vàlid.');
  }
  const comparison = compareVersions(latestVersion, currentVersion);
  return {
    currentVersion,
    latestVersion,
    updateAvailable: comparison > 0,
    releaseUrl,
    releaseName: String(release.name || tag),
    noRelease: false
  };
}

module.exports = { parseVersion, compareVersions, checkLatestRelease };
