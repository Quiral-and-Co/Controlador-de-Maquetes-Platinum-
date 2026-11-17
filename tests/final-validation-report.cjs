'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'artifacts', 'final-validation');
fs.mkdirSync(outDir, { recursive: true });
const forcedEnv = { ...process.env, JMRI_TC_ENABLE_DCC: '0', JMRI_TC_SAFETY_VALIDATED: '0' };
const checks = [];
function run(id, command, args) {
  const started = new Date();
  const result = spawnSync(command, args, { cwd: root, env: forcedEnv, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 20 * 1024 * 1024 });
  const ended = new Date();
  const log = ['$ ' + command + ' ' + args.join(' '), 'started=' + started.toISOString(), 'ended=' + ended.toISOString(), 'exitCode=' + result.status, result.stdout || '', result.stderr || ''].join('\n');
  const logPath = path.join(outDir, id + '.log');
  fs.writeFileSync(logPath, log, 'utf8');
  checks.push({ id, command: command + ' ' + args.join(' '), status: result.status === 0 ? 'PASS' : 'FAIL', exitCode: result.status, startedAt: started.toISOString(), endedAt: ended.toISOString(), evidence: path.relative(root, logPath).replaceAll(path.sep, '/') });
  return result.status === 0;
}
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
const dccDisabled = forcedEnv.JMRI_TC_ENABLE_DCC !== '1' && forcedEnv.JMRI_TC_SAFETY_VALIDATED !== '1';
checks.push({ id: 'dcc-default-disabled', command: 'forced safe environment', status: dccDisabled ? 'PASS' : 'FAIL', evidence: 'artifacts/final-validation/report.json#dccEnvironment' });
if (process.platform !== 'win32') {
  checks.push({ id: 'windows-nsis-build', command: 'npm run dist:win', status: 'FAIL', exitCode: null, evidence: 'Windows runner required' });
} else {
  run('unit-regression', 'npm', ['test']);
  run('browser-regression', 'npm', ['run', 'test:browser']);
  run('geometry-acceptance', 'node', ['tests/editor-geometry-acceptance.cjs']);
  run('nsis-build', 'npm', ['run', 'dist:win']);
}
const dist = path.join(root, 'dist');
const installers = process.platform === 'win32' && fs.existsSync(dist)
  ? fs.readdirSync(dist, { withFileTypes: true }).filter(e => e.isFile() && e.name.toLowerCase().endsWith('.exe')).map(e => path.join(dist, e.name))
  : [];
const installerEvidence = installers.map(file => ({ file: path.relative(root, file).replaceAll(path.sep, '/'), bytes: fs.statSync(file).size, sha256: sha256(file) }));
checks.push({ id: 'installer-artifact', command: 'verify dist/*.exe and calculate SHA-256', status: installerEvidence.length ? 'PASS' : 'FAIL', evidence: 'artifacts/final-validation/report.json#installers' });
const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY || 'local', commit: process.env.GITHUB_SHA || 'not-provided',
  runner: { platform: process.platform, release: os.release(), arch: process.arch },
  runtime: { node: process.version, npm: spawnSync('npm', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' }).stdout.trim() },
  dccEnvironment: { JMRI_TC_ENABLE_DCC: forcedEnv.JMRI_TC_ENABLE_DCC, JMRI_TC_SAFETY_VALIDATED: forcedEnv.JMRI_TC_SAFETY_VALIDATED, policy: 'DCC remains disabled; this workflow never arms physical outputs.' },
  installers: installerEvidence, checks,
  physicalProtocol: {
    status: 'BLOCKED',
    reason: 'CI has no access to the physical CS2 60215, track wiring, sensors or independent emergency-stop circuit.',
    evidenceRequired: ['operator identity and local test date', 'CS2 60215 model/firmware and JMRI read-only connection evidence', 'sensor-by-sensor occupied/free observations and timestamps', 'inspection of wiring, polarity, fuses and isolation', 'independent emergency-stop inspection/test record', 'confirmation no locomotive/accessory command was sent and DCC remained disabled']
  },
  overall: checks.every(c => c.status === 'PASS') ? 'PASS_WITH_PHYSICAL_BLOCK' : 'FAIL'
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
const lines = ['# Final validation report', '', '- Generated: ' + report.generatedAt, '- Repository: ' + report.repository, '- Commit: ' + report.commit, '- Runtime: Node ' + report.runtime.node + '; npm ' + report.runtime.npm, '- DCC: disabled (' + forcedEnv.JMRI_TC_ENABLE_DCC + '/' + forcedEnv.JMRI_TC_SAFETY_VALIDATED + ')', '- Overall: **' + report.overall + '**', '', '| Check | Result | Evidence |', '|---|---|---|'];
for (const c of checks) lines.push('| ' + c.id + ' | ' + c.status + ' | ' + c.evidence + ' |');
lines.push('', '## Installer evidence', '');
if (installerEvidence.length) for (const i of installerEvidence) lines.push('- ' + i.file + ' — ' + i.bytes + ' bytes — SHA-256 ' + i.sha256);
else lines.push('- No installer artifact verified.');
lines.push('', '## Physical protocol', '', '**BLOCKED — not executed by CI.** Physical checks require an operator at the layout and must remain read-only with DCC disabled.', '');
for (const item of report.physicalProtocol.evidenceRequired) lines.push('- [ ] ' + item);
lines.push('', 'Do not treat CI PASS as physical acceptance or permission to enable DCC.');
fs.writeFileSync(path.join(outDir, 'report.md'), lines.join('\n') + '\n', 'utf8');
if (report.overall === 'FAIL') process.exitCode = 1;
