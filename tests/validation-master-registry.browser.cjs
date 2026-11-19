'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(String(err)); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

function samePersistedFields(actual, expected, label) {
  assert.equal(actual.projectId, expected.projectId, label + ': projectId');
  const fields = value => value.records.map(r => ({
    registryId:r.registryId, identityKey:r.identityKey, status:r.status,
    notes:r.notes, validation:r.validation
  }));
  assert.deepEqual(fields(actual), fields(expected), label + ': identifiers, annotations and statuses');
  assert.deepEqual(actual.audit, expected.audit, label + ': audit trail');
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  let browser;
  let context;
  try {
    // A regular isolated context surfaces Blob downloads reliably in headless CI.
    browser = await chromium.launch({ headless:true, args:['--no-sandbox'] });
    context = await browser.newContext({ acceptDownloads:true });
    let page = await context.newPage();
    page.on('pageerror', error => console.error('Browser page error:', error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('Browser console error:', message.text()); });
    await page.goto('http://127.0.0.1:' + port + '/index.html');
    await page.waitForFunction(() => window.JMRI_TC_DISPATCHER && window.JMRI_TC_VALIDATION_MASTER_REGISTRY_UI);
    // This integration test specifically exercises the browser fallback behind the
    // legacy toolbar command. The app's active desktop mode may hide that toolbar;
    // expose it in the test viewport without changing production UI behavior.
    await page.addStyleTag({ content: '.toolbar { display:flex !important; visibility:visible !important; } #exportBtn { display:inline-flex !important; visibility:visible !important; }' });

    const makeProjectFixture = async (projectId, suffix, name) => page.evaluate(({projectId,suffix,name}) => {
      const c = JSON.parse(JSON.stringify(window.JMRI_TC_DISPATCHER.getConfig()));
      c.projectId = projectId;
      c.name = name;
      c.signals = [{ id:'SIG-'+suffix, name:'Senyal '+suffix }];
      c.levels[0].blocks = [{ id:'BLK-'+suffix, name:'Bloc '+suffix, trackIds:[], sensorIds:[], lengthMm:0, verified:false }];
      c.levels[0].sensors = [{ id:'SNS-'+suffix, systemName:'LS-'+suffix, userName:'Sensor '+suffix, verified:false, invert:false }];
      c.levels[0].tracks = [{
        id:'TRK-'+suffix, type:'turnout', name:'Desviament '+suffix,
        x:100, y:100, rotation:0, levelId:1, blockId:'', sensorName:'',
        turnoutSystemName:'LT-'+suffix, geometry:{lengthMm:180,radiusMm:360,angleDeg:30}
      }];
      delete c.validationMasterRegistry;
      return c;
    }, {projectId,suffix,name});

    const importProject = async (project, filename) => {
      await page.locator('#configFile').setInputFiles({
        name:filename, mimeType:'application/json', buffer:Buffer.from(JSON.stringify(project))
      });
      await page.waitForFunction(id =>
        window.JMRI_TC_DISPATCHER.getConfig().projectId === id &&
        window.JMRI_TC_DISPATCHER.getConfig().validationMasterRegistry?.records.length === 4,
        project.projectId
      );
      return page.evaluate(() => JSON.parse(JSON.stringify(
        window.JMRI_TC_DISPATCHER.getConfig().validationMasterRegistry
      )));
    };

    const fixtureA = await makeProjectFixture('vmr-browser-project-A', 'A', 'Projecte de navegador A');
    const projectA = await importProject(fixtureA, 'project-A.json');
    assert.ok(projectA.records.every(r => r.sourceId.endsWith('-A')));

    // Floating panels can overlap by design. Activate the VMR taskbar entry
    // before interacting so the Märklin catalogue window cannot intercept clicks.
    const registryTask = page.locator('.desktop-task').filter({ hasText:'Registre mestre de validació' });
    assert.equal(await registryTask.count(), 1, 'the validation registry must have a taskbar window entry');
    await registryTask.click();
    await page.waitForFunction(() => {
      const windows = [...document.querySelectorAll('.desktop-window')];
      const registry = windows.find(node => node.getAttribute('aria-label') === 'Registre mestre de validació');
      const catalogue = windows.find(node => node.getAttribute('aria-label') === 'Base de dades digital · Märklin CS2 60215');
      if (!registry || !catalogue) return false;
      const registryZ = Number.parseInt(getComputedStyle(registry).zIndex, 10);
      const catalogueZ = Number.parseInt(getComputedStyle(catalogue).zIndex, 10);
      const addNote = [...registry.querySelectorAll('button')].find(button => button.textContent.trim() === 'Afegir nota');
      if (!(registryZ > catalogueZ) || !addNote) return false;
      const rect = addNote.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return !!hit && (hit === addNote || addNote.contains(hit));
    }, null, { timeout:5000 });

    const noteInput = page.locator('#validationMasterRegistry input[placeholder="Nota de revisió / incidència"]');
    await noteInput.fill('Anotació exclusiva del projecte A');
    await page.getByRole('button', { name:'Afegir nota' }).click();
    await page.waitForFunction(() => {
      const s = window.JMRI_TC_DISPATCHER.getConfig().validationMasterRegistry;
      return s.records.some(r => r.notes.some(n => n.text === 'Anotació exclusiva del projecte A')) &&
        s.audit.some(e => e.action === 'NOTE_ADDED');
    });

    const exportDiagnostics = await page.evaluate(() => ({
      buttonPresent: !!document.querySelector('#exportBtn'),
      buttonDisabled: !!document.querySelector('#exportBtn')?.disabled,
      handlerInstalled: typeof document.querySelector('#exportBtn')?.onclick === 'function',
      nativeSaveBridge: typeof window.jmriDesktop?.saveProject === 'function'
    }));
    assert.ok(exportDiagnostics.buttonPresent && !exportDiagnostics.buttonDisabled && exportDiagnostics.handlerInstalled,
      'browser project export button must be present, enabled, and wired: ' + JSON.stringify(exportDiagnostics));
    assert.equal(exportDiagnostics.nativeSaveBridge, false,
      'browser test must exercise the browser-download fallback, not Electron native save');
    // Attach both promise handlers immediately: otherwise a download timeout can become
    // an unhandled rejection while Playwright is still waiting for the button click.
    const projectExportDownload = page.waitForEvent('download', { timeout:30000 })
      .then(download => ({ download }), error => ({ error }));
    await page.locator('#exportBtn').click({ timeout:10000 });
    const downloadResult = await projectExportDownload;
    if (downloadResult.error) {
      const diagnostics = await page.evaluate(() => ({
        exportLog: [...document.querySelectorAll('#eventLog li')].slice(0,8).map(x => x.textContent),
        blobUrlSupported: typeof URL.createObjectURL === 'function',
        blobSupported: typeof Blob === 'function',
        anchorCount: document.querySelectorAll('a[download]').length,
        anchors: [...document.querySelectorAll('a[download]')].map(a => ({ href:a.href, download:a.download, connected:a.isConnected })),
        exportButtonHandler: typeof document.querySelector('#exportBtn')?.onclick
      }));
      throw new Error('Project JSON download did not start: ' + JSON.stringify(diagnostics) + '; ' + downloadResult.error.message);
    }
    const projectDownload = downloadResult.download;
    const projectPath = await projectDownload.path();
    assert.ok(projectPath, 'project export must create a browser download');
    const exportedProject = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
    assert.equal(exportedProject.projectId, 'vmr-browser-project-A');
    assert.ok(exportedProject.validationMasterRegistry, 'project export must contain the VMR');
    const exportedA = exportedProject.validationMasterRegistry;
    samePersistedFields(exportedA, await page.evaluate(() => JSON.parse(JSON.stringify(
      window.JMRI_TC_DISPATCHER.getConfig().validationMasterRegistry
    ))), 'project A export');

    const fixtureB = await makeProjectFixture('vmr-browser-project-B', 'B', 'Projecte de navegador B');
    const projectB = await importProject(fixtureB, 'project-B.json');
    assert.notEqual(projectB.projectId, projectA.projectId);
    assert.ok(projectB.records.every(r => r.sourceId.endsWith('-B')), 'project B must contain only its own source records');
    assert.ok(projectB.records.every(r => r.notes.length === 0), 'project A annotations must not leak into project B');
    assert.ok(!projectB.audit.some(e => e.action === 'NOTE_ADDED'), 'project A audit events must not leak into project B');
    const storageKeys = await page.evaluate(() => Object.keys(localStorage).filter(k =>
      k.startsWith('jmri-tc-validation-master-registry-v1:')));
    assert.ok(storageKeys.some(k => k.endsWith('vmr-browser-project-A')));
    assert.ok(storageKeys.some(k => k.endsWith('vmr-browser-project-B')), 'projects must use separate browser storage keys');

    const importedA = await importProject(exportedProject, 'project-A-export.json');
    samePersistedFields(importedA, exportedA, 'project A re-import');

    const captureActs = async () => {
      const downloads = [];
      const onDownload = download => downloads.push(download);
      page.on('download', onDownload);
      await page.getByRole('button', { name:'Generar acta Markdown + JSON' }).click();
      await page.waitForTimeout(500);
      page.off('download', onDownload);
      const names = downloads.map(d => d.suggestedFilename());
      console.log('Captured validation downloads:', names.join(', '));
      const md = names.find(n => n.endsWith('.md'));
      const json = names.find(n => n.endsWith('.json'));
      assert.ok(md && json, 'each validation act must download Markdown and JSON');
      assert.equal(path.basename(md, '.md'), path.basename(json, '.json'), 'Markdown and JSON must refer to the same act');
      return path.basename(md, '.md');
    };
    const actOne = await captureActs();
    const actTwo = await captureActs();
    assert.notEqual(actOne, actTwo, 'two consecutive browser-generated acts must have unique IDs');

    // Reopen an isolated browser context, then import the exported project.
    await page.close();
    await context.close();
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('http://127.0.0.1:' + port + '/index.html');
    await page.waitForFunction(() => window.JMRI_TC_DISPATCHER && window.JMRI_TC_VALIDATION_MASTER_REGISTRY_UI);
    const afterRestart = await importProject(exportedProject, 'project-A-after-browser-restart.json');
    samePersistedFields(afterRestart, exportedA, 'project A after browser restart and import');

    console.log('PASS: Chromium UI project isolation, project JSON download/import, browser close/reopen, VMR IDs/status/notes/audit persistence, and unique consecutive validation acts');
  } finally {
    if (context) await context.close().catch(() => {});
    await browser?.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
