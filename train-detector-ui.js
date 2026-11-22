(() => {
'use strict';
const core=window.JMRI_TC_TRAIN_DETECTOR_CORE,protocols=window.JMRI_TC_TRAIN_DETECTOR_PROTOCOLS;
if(!core||!protocols)return;
const params=new URLSearchParams(location.search);
if(params.get('nativeWindow')!=='trainDetector')return;
const style=document.createElement('style');
style.textContent=`
html,body{margin:0!important;background:#101b28!important;color:#edf3fa!important;font-family:Segoe UI,Arial,sans-serif}
body>*:not(#trainDetectorApp){display:none!important}
#trainDetectorApp{min-height:100vh;padding:22px;box-sizing:border-box;background:linear-gradient(145deg,#101b28,#17283a)}
.td-head{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.td-head h1{margin:0;font-size:24px}.td-muted{color:#aab8c8}.td-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin-top:20px}
.td-card{background:#1c3044;border:1px solid #38516a;border-radius:12px;padding:16px;min-height:125px}
.td-card h3{margin:0 0 8px}.td-state{font-size:21px;font-weight:700;margin:12px 0}.td-state[data-state=OCCUPIED]{color:#ff7777}.td-state[data-state=FREE]{color:#62d69a}.td-state[data-state=UNKNOWN]{color:#ffd27a}
.td-actions{display:flex;gap:8px;flex-wrap:wrap}.td-actions button,.td-dialog button{border:1px solid #58718a;background:#29435d;color:#fff;border-radius:8px;padding:9px 13px;cursor:pointer}
.td-primary{background:#176b9c!important}.td-dialog{width:min(900px,calc(100vw - 36px));max-height:88vh;overflow:auto;background:#17283a;color:#edf3fa;border:1px solid #58718a;border-radius:14px;padding:20px}
.td-dialog::backdrop{background:#0009}.td-formgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.td-dialog label{display:flex;flex-direction:column;gap:5px;margin:8px 0}.td-dialog input,.td-dialog select{padding:9px;border-radius:7px;border:1px solid #58718a;background:#0f1c29;color:#fff;min-width:0}
.td-sensor{display:flex;align-items:center;gap:9px;padding:8px;border-bottom:1px solid #38516a}.td-sensor input{width:auto}
.td-warning{border-left:4px solid #e6b450;padding:10px 12px;background:#332d20;color:#ffe4a3;border-radius:5px}
.td-pill{display:inline-block;border:1px solid #58718a;border-radius:99px;padding:3px 8px;font-size:11px;margin:2px;color:#cbd9e8}
.td-status{font-size:12px;color:#b8c9da;margin-top:8px}.td-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.td-tools input,.td-tools select{padding:8px;border-radius:7px;background:#0f1c29;color:#fff;border:1px solid #58718a}
.td-sensor-list{max-height:220px;overflow:auto;border:1px solid #38516a;border-radius:8px;padding:6px}
`;
document.head.append(style);
const app=document.createElement('main');app.id='trainDetectorApp';
app.innerHTML=`<header class="td-head"><div><h1>Monitor de detectors d’ocupació</h1><p class="td-muted">Supervisió dels blocs, retromòduls i protocols de retroinformació · només lectura</p></div><div class="td-actions"><button id="tdRefresh">Actualitzar</button><button id="tdConfig" class="td-primary">Configuració dels detectors…</button></div></header><p id="tdConnection" class="td-muted">Esperant connexió amb el sistema de control…</p><div class="td-warning">Supervisió informativa: no autoritza itineraris, moviment de trens ni sortides físiques. Una lectura absent, caducada o desconeguda mai no equival a via lliure. Els protocols es gestionen a través del servidor JMRI connectat; no s’envien ordres als retromòduls.</div><div class="td-tools"><input id="tdSearch" placeholder="Filtrar per bloc, detector o adreça…" aria-label="Filtrar detectors"><select id="tdFilter"><option value="ALL">Tots els estats</option><option value="OCCUPIED">Ocupats</option><option value="FREE">Lliures</option><option value="UNKNOWN">Desconeguts</option></select></div><section id="tdBlocks" class="td-grid" aria-live="polite"></section><dialog id="tdDialog" class="td-dialog"><form method="dialog"><div class="td-head"><h2>Configuració dels detectors d’ocupació</h2><button value="cancel" aria-label="Tancar">✕</button></div></form><p class="td-muted">Configura el protocol, el bus, el retromòdul i l’entrada. La verificació física s’ha de completar separadament al registre de validació; aquest diàleg no marca cap detector com a verificat.</p><section class="td-formgrid"><label>Protocol<select id="tdProtocol"></select></label><label>Bus / interfície<input id="tdBus" maxlength="80" placeholder="p. ex. LocoNet, S88-N, RS"></label><label>Adreça del retromòdul<input id="tdModuleAddress" maxlength="80" placeholder="p. ex. 1 / 101"></label><label>Entrada / canal<input id="tdInput" type="number" min="1" max="4096" value="1"></label><label>System name JMRI<input id="tdSystemName" maxlength="80" placeholder="p. ex. LS101"></label><label>Nom visible<input id="tdUserName" maxlength="80" placeholder="Detector tram nord"></label><label>Filtre antirebots (ms)<input id="tdDebounce" type="number" min="0" max="5000" value="40"></label><label>Caducitat lectura (ms)<input id="tdTimeout" type="number" min="1000" max="120000" value="15000"></label></section><label><input id="tdInvert" type="checkbox"> Invertir la lògica ocupat/lliure</label><div class="td-actions"><button id="tdSaveSensor" type="button" class="td-primary">Registrar detector</button><button id="tdNewSensor" type="button">Netejar / nou</button><button id="tdDeleteSensor" type="button">Eliminar detector</button></div><hr><label>Bloc a configurar<select id="tdBlock"></select></label><div id="tdSensorChoices" class="td-sensor-list"></div><div class="td-actions"><button id="tdSaveMapping" type="button" class="td-primary">Desar assignació al bloc</button></div><p id="tdConfigMessage" class="td-status" role="status"></p><p class="td-muted">Compatibilitat de configuració: S88, S88-N, RS (Lenz), LocoNet, R-bus, XpressNet/feedback, JMRI genèric i protocols personalitzats. La lectura efectiva depèn que el sistema digital i el perfil corresponent estiguin configurats al servidor JMRI.</p><div class="td-actions"><button id="tdClose" type="button">Tancar</button></div></dialog>`;
document.body.append(app);
const $=id=>document.getElementById(id);
function config(){return window.JMRI_TC_DISPATCHER?.getConfig?.()||{};}
function telemetry(){return window.JMRI_TC_BOARD?.getTelemetry?.()||{};}
function allSensors(){return(config().levels||[]).flatMap(level=>(level.sensors||[]).map(sensor=>({level,sensor})));}
function findSensor(id){return allSensors().find(item=>item.sensor.id===id)||null;}
function refresh(){
 const c=config(),t=telemetry(),rows=core.inspect(c,t),host=$('tdBlocks'),query=$('tdSearch').value.trim().toLowerCase(),filter=$('tdFilter').value;
 host.replaceChildren();
 $('tdConnection').textContent=t.connected===true?'Connectat al servidor JMRI · les lectures s’avaluen per antiguitat':'Desconnectat · totes les lectures es consideren desconegudes';
 let shown=0;
 for(const row of rows){
  const sensorText=row.sensorReadings.map(r=>r.userName+' '+r.sensorName).join(' ').toLowerCase();
  const sensorMeta=allSensors().filter(x=>row.sensorReadings.some(r=>r.id===x.sensor.id));
  const metaText=sensorMeta.map(x=>[x.sensor.protocol,x.sensor.bus,x.sensor.moduleAddress,x.sensor.input].join(' ')).join(' ').toLowerCase();
  if(filter!=='ALL'&&row.state!==filter)continue;
  if(query&&!(row.name+' '+row.levelName+' '+sensorText+' '+metaText).toLowerCase().includes(query))continue;
  shown++;
  const card=document.createElement('article');card.className='td-card';
  const h=document.createElement('h3');h.textContent=row.name+' · '+row.levelName;
  const state=document.createElement('div');state.className='td-state';state.dataset.state=row.state;state.textContent=({OCCUPIED:'OCUPAT',FREE:'LLIURE',UNKNOWN:'DESCONEGUT'})[row.state];
  const detail=document.createElement('p');detail.className='td-muted';detail.textContent=row.reason;
  const count=document.createElement('small');count.className='td-muted';count.textContent=row.sensorCount+' detector(s) assignat(s)';
  const readings=document.createElement('ul');readings.className='td-muted';
  for(const reading of row.sensorReadings){
   const item=document.createElement('li'),meta=findSensor(reading.id)?.sensor||{};
   item.textContent=(reading.userName||reading.sensorName)+' · '+({OCCUPIED:'Ocupat',FREE:'Lliure',UNKNOWN:'Sense lectura actual'}[reading.state])+' · '+(protocols.PROTOCOLS[protocols.canonical(meta.protocol)].label||'JMRI')+' · mòdul '+(meta.moduleAddress||'—')+' / entrada '+(meta.input||'—')+(reading.verified?' · verificat':' · pendent de verificació');
   readings.append(item);
  }
  card.append(h,state,detail,count,readings);host.append(card);
 }
 if(!shown){const p=document.createElement('p');p.className='td-muted';p.textContent=rows.length?'Cap resultat coincideix amb el filtre.':'No hi ha blocs definits. Crea blocs a l’editor i assigna-hi detectors.';host.append(p);}
}
function openConfig(){
 const select=$('tdBlock');select.replaceChildren();
 for(const level of config().levels||[])for(const block of level.blocks||[]){const o=document.createElement('option');o.value=String(level.id)+'|'+block.id;o.textContent=(level.name||'Nivell '+level.id)+' · '+(block.name||block.id);select.append(o);}
 renderChoices();resetSensorForm();$('tdDialog').showModal();
}
function selectedBlock(){const [levelId,blockId]=String($('tdBlock').value||'').split('|');const level=(config().levels||[]).find(l=>String(l.id)===levelId);return level?{level,block:(level.blocks||[]).find(b=>b.id===blockId)}:null;}
function resetSensorForm(){ $('tdProtocol').value='S88';$('tdBus').value='';$('tdModuleAddress').value='';$('tdInput').value='1';$('tdSystemName').value='';$('tdUserName').value='';$('tdDebounce').value='40';$('tdTimeout').value='15000';$('tdInvert').checked=false;$('tdSaveSensor').textContent='Registrar detector';$('tdDeleteSensor').disabled=true;$('tdSaveSensor').dataset.editId='';}
function loadSensor(id){const found=findSensor(id);if(!found)return;const s=found.sensor;$('tdProtocol').value=protocols.canonical(s.protocol);$('tdBus').value=s.bus||'';$('tdModuleAddress').value=s.moduleAddress||'';$('tdInput').value=s.input||1;$('tdSystemName').value=s.systemName||'';$('tdUserName').value=s.userName||'';$('tdDebounce').value=s.debounceMs??40;$('tdTimeout').value=s.timeoutMs??15000;$('tdInvert').checked=s.invert===true;$('tdSaveSensor').textContent='Desar canvis del detector';$('tdSaveSensor').dataset.editId=id;$('tdDeleteSensor').disabled=false;}
function renderChoices(){
 const host=$('tdSensorChoices');host.replaceChildren();const selected=selectedBlock();
 if(!selected){host.textContent='No hi ha cap bloc disponible.';return;}
 for(const sensor of selected.level.sensors||[]){
  const row=document.createElement('label');row.className='td-sensor';
  const cb=document.createElement('input');cb.type='checkbox';cb.className='td-map-sensor';cb.value=sensor.id;cb.checked=(selected.block.sensorIds||[]).includes(sensor.id);
  const name=document.createElement('span');name.textContent=(sensor.userName||sensor.systemName)+' · '+protocols.PROTOCOLS[protocols.canonical(sensor.protocol)].label+' · '+(sensor.moduleAddress||'mòdul no definit')+'/'+(sensor.input||'—')+(sensor.verified?' · verificat':' · pendent de verificació');
  const edit=document.createElement('button');edit.type='button';edit.textContent='Editar';edit.addEventListener('click',()=>loadSensor(sensor.id));
  row.append(cb,name,edit);host.append(row);
 }
}
function saveSensor(){
 const selected=selectedBlock(),id=$('tdSaveSensor').dataset.editId;
 if(!selected){$('tdConfigMessage').textContent='Primer crea un bloc a l’editor.';return;}
 const sensor={id:id||'',protocol:protocols.canonical($('tdProtocol').value),bus:$('tdBus').value.trim(),moduleAddress:$('tdModuleAddress').value.trim(),input:Number($('tdInput').value),systemName:$('tdSystemName').value.trim(),userName:$('tdUserName').value.trim(),debounceMs:Number($('tdDebounce').value),timeoutMs:Number($('tdTimeout').value),invert:$('tdInvert').checked};
 const validation=protocols.validate(sensor);if(!validation.valid){$('tdConfigMessage').textContent=validation.errors.join(' ');return;}
 const all=allSensors();if(all.some(x=>x.sensor.systemName===sensor.systemName&&x.sensor.id!==id)){$('tdConfigMessage').textContent='Aquest system name ja està registrat.';return;}
 window.JMRI_TC_DISPATCHER?.checkpoint?.();selected.level.sensors=selected.level.sensors||[];
 if(id){const found=findSensor(id);if(!found){$('tdConfigMessage').textContent='No s’ha trobat el detector que vols editar.';return;}Object.assign(found.sensor,sensor);}
 else{const safe=sensor.systemName.replace(/[^a-zA-Z0-9_-]/g,'_');let sensorId='S-'+safe,suffix=2;while(allSensors().some(x=>x.sensor.id===sensorId))sensorId='S-'+safe+'-'+suffix++;sensor.id=sensorId;sensor.verified=false;selected.level.sensors.push(sensor);}
 const requested=window.JMRI_TC_BOARD?.requestSensorReading?.(sensor.systemName);
 window.JMRI_TC_DISPATCHER?.refresh?.();$('tdConfigMessage').textContent=(id?'Detector actualitzat. ':'Detector registrat. ')+(requested?'Lectura sol·licitada al servidor JMRI.':'Connecta el servidor per rebre lectures.')+' Verificació física pendent.';
 resetSensorForm();renderChoices();refresh();
}
function deleteSensor(){const id=$('tdSaveSensor').dataset.editId,found=findSensor(id);if(!found)return;window.JMRI_TC_DISPATCHER?.checkpoint?.();found.level.sensors=found.level.sensors.filter(s=>s.id!==id);for(const level of config().levels||[])for(const block of level.blocks||[])block.sensorIds=(block.sensorIds||[]).filter(x=>x!==id);window.JMRI_TC_DISPATCHER?.refresh?.();$('tdConfigMessage').textContent='Detector eliminat i assignacions retirades dels blocs.';resetSensorForm();renderChoices();refresh();}
function saveMapping(){const selected=selectedBlock();if(!selected)return;const checked=[...$('tdSensorChoices').querySelectorAll('.td-map-sensor:checked')].map(x=>x.value);window.JMRI_TC_DISPATCHER?.checkpoint?.();selected.block.sensorIds=checked;window.JMRI_TC_DISPATCHER?.refresh?.();$('tdConfigMessage').textContent='Assignació desada. El bloc continua pendent de verificació física.';refresh();}
for(const [key,item] of Object.entries(protocols.PROTOCOLS)){const o=document.createElement('option');o.value=key;o.textContent=item.label;$('tdProtocol').append(o);}
$('tdConfig').onclick=openConfig;$('tdRefresh').onclick=refresh;$('tdBlock').onchange=renderChoices;$('tdClose').onclick=()=>$('tdDialog').close();$('tdSaveSensor').onclick=saveSensor;$('tdNewSensor').onclick=resetSensorForm;$('tdDeleteSensor').onclick=deleteSensor;$('tdSaveMapping').onclick=saveMapping;$('tdSearch').oninput=refresh;$('tdFilter').onchange=refresh;
if(window.JMRI_TC_BOARD?.requestSensorReading){const request=()=>{const names=[...new Set(allSensors().map(x=>x.sensor.systemName).filter(Boolean))];names.forEach(n=>window.JMRI_TC_BOARD.requestSensorReading(n));};request();window.setInterval(()=>{refresh();request();},2000);}else window.setInterval(refresh,1000);
refresh();
})();