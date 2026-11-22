'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),ui=fs.readFileSync(path.join(__dirname,'..','cab-panels-ui.js'),'utf8'),dm=require('../deadman-core.js'),state=dm.createState();
for(const id of ['deadmanStandalonePanel','dmWindowPress','dmWindowRelease','dmWindowRearm','stationsPanel','stationAdd','stationStops'])assert.ok(html.includes('id="'+id+'"'),'Missing panel control '+id);
for(const command of ['windowShowDeadman','windowShowProtection','windowShowRadio','windowShowSpielewelt','windowShowStations','windowShowCommunications','windowShowDiagnostics','windowShowTelemetry','windowShowEmergencies','windowShowDrivers'])assert.ok(html.includes('data-ribbon-command="'+command+'"'),'Missing ribbon command '+command);
assert.ok(ui.includes('core.evaluate(state)'));assert.equal(dm.press(state,0).ok,true);assert.equal(dm.evaluate(state,36000).action,'TRIP');assert.equal(state.tripped,true);
console.log('PASS: independent deadman window, station panel and ribbon contracts');