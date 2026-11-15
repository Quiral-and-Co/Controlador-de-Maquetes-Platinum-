const fs = require('fs');
const vm = require('vm');
class El {
  constructor(id=''){this.id=id;this.value='';this.textContent='';this.innerHTML='';this.children=[];this.dataset={};this.handlers={};this.className='';this.disabled=false;this.classList={add:()=>{},toggle:()=>{},remove:()=>{}};this.style={};}
  addEventListener(n,fn){this.handlers[n]=fn;}
  append(...xs){this.children.push(...xs);}
  prepend(x){this.children.unshift(x);}
  replaceChildren(...xs){this.children=[...xs];}
  setAttribute(k,v){this[k]=v;}
  getAttribute(k){return this[k]??null;}
  remove(){}
  closest(){return null;}
}
const ids=['levelCount','pieceCount','connectionCount','blockCount','unknownCount','levelList','currentLevelTitle','currentLevelSubtitle','pieceLayer','connectionLayer','portLayer','emptyProperties','pieceProperties','selectionText','propId','propName','propType','propX','propY','propRotation','propLength','propRadius','propAngle','propBlock','propSensor','rotateBtn','deleteBtn','duplicateBtn','undoBtn','redoBtn','measureBtn','measureStatus','connectBtn2','portModeBtn','portStatus','trackSvg','cursorCoords','eventLog','modernBlocks','sensorSummary','endpointText','host','port','connectionText','connectionBadge','connectBtn','disconnectBtn','configFile','configName','exportBtn','modeClassic','modeModern','modernPanel','newBlockName','addBlockBtn','blockRegistry','newSensorSystemName','newSensorUserName','addSensorBtn','sensorRegistry','propTurnout','propLevel','moveLevelBtn','validateTopologyBtn','topologyReport','catalogueSearch','catalogueCategory','catalogueList'];
const els=Object.fromEntries(ids.map(x=>[x,new El(x)]));els.host.value='127.0.0.1';els.port.value='12080';
const palette=['straight','curve','turnout','block'].map(type=>{const e=new El();e.dataset.piece=type;return e;});
const shell=new El('shell');
const document={addEventListener:()=>{},getElementById:id=>els[id]||(els[id]=new El(id)),createElement:tag=>new El(tag),createElementNS:()=>new El('svg'),querySelectorAll:q=>q==='[data-piece]'?palette:[],querySelector:q=>shell};
const window={MARKLIN_C_CATALOGUE:JSON.parse(fs.readFileSync(__dirname+'/../catalogue-marklin-c.json','utf8'))};
vm.runInNewContext(fs.readFileSync(__dirname+'/../app.js','utf8'),{document,window,console,Date,Math,JSON,Number,String,Array,Set,Map,WebSocket:function(){}});
if(els.levelCount.textContent!==5)throw Error('Expected five levels');
if(els.catalogueList.children.length!==68)throw Error('Expected 68 catalogue entries, got '+els.catalogueList.children.length);
const c24188=els.catalogueList.children.find(x=>x.dataset.catalogue==='24188');if(!c24188)throw Error('Catalogue reference 24188 missing');c24188.onclick();if(els.pieceCount.textContent!==1||!els.propName.value.includes('24188'))throw Error('Catalogue insertion failed');if(els.propLength.value!==188.3)throw Error('Catalogue length geometry not applied');els.undoBtn.onclick();if(els.pieceCount.textContent!==0)throw Error('Undo catalogue insertion failed');
els.validateTopologyBtn.onclick();if(!els.topologyReport.textContent.includes('0 error(s)'))throw Error('Empty topology should validate without errors');
palette[0].onclick();
if(els.pieceCount.textContent!==1)throw Error('Palette did not add a track primitive');
if(!els.propId.value.startsWith('STRAIGHT-'))throw Error('New piece not selected');
els.rotateBtn.onclick();
if(els.propRotation.value!==15)throw Error('Rotation action failed');
els.propName.value='Recta de prova';els.propName.handlers.change({target:els.propName});
if(els.pieceLayer.children.length!==1)throw Error('SVG piece not rendered');
els.propLength.value='240';els.propLength.handlers.change({target:els.propLength});
if(els.pieceLayer.children.length!==1)throw Error('Geometry edit broke SVG render');
if(els.propLength.value!==240)throw Error('Length property was not applied');

els.duplicateBtn.onclick();if(els.pieceCount.textContent!==2)throw Error('Duplicate action failed');
els.undoBtn.onclick();if(els.pieceCount.textContent!==1)throw Error('Undo failed to restore piece count');
els.redoBtn.onclick();if(els.pieceCount.textContent!==2)throw Error('Redo failed to restore duplicated piece');
// Bloc and sensor registry + assignment
els.newBlockName.value='B01';els.addBlockBtn.onclick();
if(!els.blockRegistry.innerHTML.includes('B01'))throw Error('Block registry did not create B01');
els.propBlock.value='B01';els.propBlock.handlers.change({target:els.propBlock});
if(!els.blockRegistry.innerHTML.includes('1 peça/es'))throw Error('Block assignment was not reflected in trackIds');
els.newSensorSystemName.value='LS101';els.newSensorUserName.value='Detector prova';els.addSensorBtn.onclick();
if(!els.sensorRegistry.innerHTML.includes('LS101'))throw Error('Sensor registry did not create LS101');
els.propSensor.value='LS101';els.propSensor.handlers.change({target:els.propSensor});
if(!els.sensorSummary.textContent.includes('LS101'))throw Error('Sensor assignment was not reflected in monitoring summary');
if(!window.JMRI_TC_BOARD||window.JMRI_TC_BOARD.getSensorState({sensorName:'LS101'}).code!=='UNKNOWN')throw Error('Board sensor should fail closed when reading/verification is missing');
window.JMRI_TC_BOARD.applySensorReading('LS101',4);
if(window.JMRI_TC_BOARD.getSensorState({sensorName:'LS101'}).code!=='UNKNOWN')throw Error('Unverified sensor must remain unknown on the board');
if(!els.pieceLayer.children.some(x=>x.innerHTML.includes('sensor-indicator')))throw Error('Assigned sensor indicator missing from SVG piece');
palette[2].onclick();
els.propTurnout.value='LT1';els.propTurnout.handlers.change({target:els.propTurnout});
window.JMRI_TC_BOARD.applyTurnoutReading('LT1',2);
if(window.JMRI_TC_BOARD.getTurnoutState({type:'turnout',turnoutSystemName:'LT1'}).code!=='CLOSED')throw Error('JMRI turnout CLOSED state was not mapped');
if(!els.pieceLayer.children.some(x=>x.innerHTML.includes('turnout-indicator')))throw Error('Assigned turnout indicator missing from SVG piece');
// Level move is blocked until level-local block and sensor assignments are cleared
els.propLevel.value='2';els.moveLevelBtn.onclick();if(els.currentLevelTitle.textContent!=='Nivell 1')throw Error('Unsafe move with assigned block/sensor was not blocked');
els.propBlock.value='';els.propBlock.handlers.change({target:els.propBlock});
els.propSensor.value='';els.propSensor.handlers.change({target:els.propSensor});
els.propTurnout.value='';els.propTurnout.handlers.change({target:els.propTurnout});
els.propLevel.value='2';els.moveLevelBtn.onclick();if(els.currentLevelTitle.textContent!=='Nivell 2')throw Error('Piece level reassignment failed');
(async()=>{
  const legacy={schemaVersion:2,name:'Legacy',scale:'H0',trackSystem:'Märklin C',room:{widthMm:3000,heightMm:1800},levelSpacingMm:110,levels:Array.from({length:5},(_,i)=>({id:i+1,name:`Nivell ${i+1}`,elevationMm:i*110,tracks:[],blocks:[],sensors:[]})),connections:[]};
  legacy.levels[0].tracks.push({id:'LEG-1',type:'straight',name:'Peça importada',x:100,y:100,rotation:0,levelId:1,blockId:'OLD01',sensorName:'LS77',geometry:{lengthMm:180,radiusMm:360,angleDeg:30}});
  await els.configFile.onchange({target:{files:[{name:'legacy-v2.json',text:async()=>JSON.stringify(legacy)}],value:''}});
  if(!els.blockRegistry.innerHTML.includes('OLD01')||!els.blockRegistry.innerHTML.includes('1 peça/es'))throw Error('v2 migration did not create provisional block registry');
  if(!els.sensorRegistry.innerHTML.includes('LS77')||!els.sensorSummary.textContent.includes('LS77'))throw Error('v2 migration did not create provisional sensor registry');
  els.validateTopologyBtn.onclick();if(!els.topologyReport.textContent.includes('0 error(s)'))throw Error('Topology audit should remain valid after migration');
  const topo={schemaVersion:3,name:'Topology test',scale:'H0',trackSystem:'Märklin C',room:{widthMm:3000,heightMm:1800},levelSpacingMm:110,levels:Array.from({length:5},(_,i)=>({id:i+1,name:`Nivell ${i+1}`,elevationMm:i*110,tracks:[],blocks:[],sensors:[]})),connections:[]};
  const mk=(id,x)=>({id,type:'straight',name:id,x,y:100,rotation:0,levelId:1,blockId:'',sensorName:'',geometry:{lengthMm:180,radiusMm:360,angleDeg:30}});
  topo.levels[0].tracks=[mk('T-A',100),mk('T-B',280)];
  topo.connections=[{id:'C1',levelId:1,from:{pieceId:'T-A',port:'B'},to:{pieceId:'T-B',port:'A'},verified:false},{id:'C2',levelId:1,from:{pieceId:'T-A',port:'B'},to:{pieceId:'T-B',port:'A'},verified:false}];
  await els.configFile.onchange({target:{files:[{name:'topology-duplicate.json',text:async()=>JSON.stringify(topo)}],value:''}});
  els.validateTopologyBtn.onclick();if(!els.topologyReport.textContent.includes('error(s)')||!els.topologyReport.textContent.includes('duplicada'))throw Error('Topology audit failed to detect duplicated connection/occupied ports');
  // Reset to a clean, empty five-level project for the manual-connection acceptance test.
  const clean={schemaVersion:3,name:'Manual ports',scale:'H0',trackSystem:'Märklin C',room:{widthMm:3000,heightMm:1800},levelSpacingMm:110,levels:Array.from({length:5},(_,i)=>({id:i+1,name:`Nivell ${i+1}`,elevationMm:i*110,tracks:[],blocks:[],sensors:[]})),connections:[]};
  await els.configFile.onchange({target:{files:[{name:'clean.json',text:async()=>JSON.stringify(clean)}],value:''}});
  // Manual, explicit port-to-port connection: no nearest-port guessing and no implicit piece movement.
  // Create two fresh straight primitives and align the second A port with the first B port.
  const connectionCountBefore=Number(els.connectionCount.textContent);
  palette[0].onclick();
  const firstId=els.propId.value, first=els.pieceLayer.children.find(x=>x.dataset.id===firstId);
  const firstPiece=els.portLayer.children.filter(x=>x.dataset.pieceId===firstId);
  let firstB=firstPiece.find(x=>x.dataset.port==='B');
  palette[0].onclick();
  const secondId=els.propId.value;
  els.propX.value='480';els.propX.handlers.change({target:els.propX});
  els.propY.value='300';els.propY.handlers.change({target:els.propY});
  els.portModeBtn.onclick();
  const findPort=(id,port)=>els.portLayer.children.find(x=>x.dataset.pieceId===id&&x.dataset.port===port);
  firstB=findPort(firstId,'B');const secondA=findPort(secondId,'A');
  if(firstB.getAttribute('role')!=='button'||firstB.getAttribute('tabindex')!=='0')throw Error('Port marker is not keyboard accessible');
  firstB.handlers.keydown({key:'Enter',currentTarget:firstB,preventDefault(){},stopPropagation(){}});
  secondA.handlers.click({currentTarget:secondA,stopPropagation(){}});
  if(!els.portStatus.textContent.includes('Connectats'))throw Error('Manual port connection failed for coincident endpoints');
  if(Number(els.connectionCount.textContent)!==connectionCountBefore+1)throw Error('Manual connection was not added to the model');
  // Self-connection must be rejected without changing the connection count.
  const firstA=findPort(firstId,'A');
  firstA.handlers.click({currentTarget:firstA,stopPropagation(){}});
  firstB.handlers.click({currentTarget:firstB,stopPropagation(){}});
  if(!els.portStatus.textContent.includes('altra peça'))throw Error('Self-connection was not rejected');
  if(Number(els.connectionCount.textContent)!==connectionCountBefore+1)throw Error('Rejected self-connection changed the model');
  // A remote endpoint (>1 mm) must be rejected, with no implicit movement.
  palette[0].onclick();const remoteId=els.propId.value;
  els.propX.value='1200';els.propX.handlers.change({target:els.propX});
  els.propY.value='700';els.propY.handlers.change({target:els.propY});
  const remoteA=findPort(remoteId,'A'),beforeRemote={x:els.propX.value,y:els.propY.value};
  firstA.handlers.click({currentTarget:firstA,stopPropagation(){}});
  remoteA.handlers.click({currentTarget:remoteA,stopPropagation(){}});
  if(!els.portStatus.textContent.includes('No connectats'))throw Error('Distant port connection was not rejected');
  if(Number(els.connectionCount.textContent)!==connectionCountBefore+1)throw Error('Rejected distant connection changed the model');
  if(els.propX.value!==beforeRemote.x||els.propY.value!==beforeRemote.y)throw Error('Rejected connection moved a piece implicitly');
  // An already occupied port must not be accepted as the first endpoint.
  firstB.handlers.click({currentTarget:firstB,stopPropagation(){}});
  if(els.portStatus.textContent.includes('Primer port:'))throw Error('Occupied port was accepted as a first endpoint');
  els.validateTopologyBtn.onclick();
  if(!els.topologyReport.textContent.includes('0 error(s)'))throw Error('Manual connection should pass topology audit');
  console.log('PASS: startup, five levels, insertion, selection, SVG, rotation, editable geometry, duplicate, undo/redo, block/sensor registries, assignment, safe level reassignment, v2 migration, topology audit, duplicate/port-conflict detection, exact manual connection, keyboard activation and rejection of self/distant/occupied ports');
})().catch(err=>{console.error(err);process.exitCode=1;});
