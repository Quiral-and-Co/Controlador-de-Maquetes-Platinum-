'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const main=fs.readFileSync('electron/main.cjs','utf8');
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const commands=['trainNewEngine','trainNewCar','trainNewTrainSet','trainNewTrain','trainList','trainProperties','trainSpeedProfile','trainCouple','trainUncouple','trainOperations','trainToggleEditMode','trainDelete'];
assert.match(main,/label: 'Tren', submenu:/,'native Train menu exists');
for(const command of commands){assert.match(main,new RegExp(command), 'native menu command '+command);assert.match(app,new RegExp("command==='"+command+"'"),'command dispatcher '+command);}
assert.match(main,/Adquirir control \(bloquejat per seguretat\).*enabled: false/);
assert.match(main,/Aturada d’emergència .*enabled: false/);
assert.match(main,/Funcions auxiliars F0–F32 .*enabled: false/);
assert.match(app,/DCC i sortides físiques deshabilitats/);
assert.match(app,/Activa primer «mode d’edició de trens»/);
assert.match(html,/data-ribbon-tab="train"/);
assert.match(html,/data-ribbon-page="train"/);
assert.match(html,/data-ribbon-command="trainNewCar">Nou vagó\/cotxe/);
assert.match(html,/train-roster-core\.js/);
console.log('PASS Train native menu, modern ribbon, functional command routing and fail-safe physical-command locks');
