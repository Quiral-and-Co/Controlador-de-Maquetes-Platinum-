(() => {
'use strict';
const core=window.JMRI_TC_TRAIN_DETECTOR_CORE;
if(!core)return;
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
.td-primary{background:#176b9c!important}.td-dialog{width:min(760px,calc(100vw - 36px));max-height:85vh;overflow:auto;background:#17283a;color:#edf3fa;border:1px solid #58718a;border-radius:14px;padding:20px}
.td-dialog::backdrop{background:#0009}.td-formgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.td-dialog label{display:flex;flex-direction:column;gap:5px;margin:8px 0}.td-dialog input,.td-dialog select{padding:9px;border-radius:7px;border:1px solid #58718a;background:#0f1c29;color:#fff;min-width:0}
.td-sensor{display:flex;align-items:center;gap:9px;padding:8px;border-bottom:1px solid #38516a}.td-sensor input{width:auto}
.td-warning{border-left:4px solid #e6b450;padding:10px 12px;background:#332d20;color:#ffe4a3;border-radius:5px}
`;
document.head.append(style);
const app=document.createElement('main');app.id='trainDetectorApp';
app.innerHTML=`<header class="td-head"><div><h1>Detecció d’ocupació</h1><p class="td-muted">Supervisió en temps real dels blocs i detectors · només lectura</p></div><div class="td-actions"><button id="tdRefresh">Actualitzar</button><button id="tdConfig" class="td-primary">Configuració…</button></div></header><p id="tdConnection" class="td-muted">Esperant connexió amb el sistema de control…</p><div class="td-warning">La detecció és informativa. No autoritza itineraris, moviment de trens ni cap sortida física. Un estat desconegut no equival mai a via lliure.</div><section id="tdBlocks" class="td-grid" aria-live="polite"></section><dialog id="tdDialog" class="td-dialog"><form method="dialog"><div class="td-head"><h2>Configuració dels detectors</h2><button value="cancel" aria-label="Tancar">✕</button></div></form><p class="td-muted">Registra els identificadors del servidor i assigna’ls als blocs. La verificació física es gestiona separadament al registre de validació.</p><section class="td-formgrid"><label>System name del detector<input id="tdSystemName" maxlength="80" placeholder="p. ex. LS101"></label><label>Nom visible<input id="tdUserName" maxlength="80" placeholder="Detector tram nord"></label></section><div class="td-actions"><button id="tdAddSensor" type="button" class="td-primary">Registrar detector</button></div><hr><label>Bloc a configurar<select id="tdBlock"></select></label><div id="tdSensorChoices"></div><p id="tdConfigMessage" class="td-muted" role="status"></p><div class="td-actions"><button id="tdSaveMapping" type="button" class="td-primary">Desar assignació</button><button id="tdClose" type="button">Tancar</button></div></dialog>`;
document.body.append(app);
const $=id=>document.getElementById(id);
function config(){return window.JMRI_TC_DISPATCHER?.getConfig?.()||{};}
function telemetry(){return window.JMRI_TC_BOARD?.getTelemetry?.()||{};}
function refresh(){
 const c=config(),t=telemetry(),rows=core.inspect(c,t),host=$('tdBlocks');host.replaceChildren();
 $('tdConnection').textContent=t.connected===true?'Connectat · lectures rebudes del servidor de control':'Desconnectat · totes les lectures es consideren desconegudes';
 if(!rows.length){const p=document.createElement('p');p.className='td-muted';p.textContent='No hi ha blocs definits. Crea blocs a l’editor i assigna-hi detectors.';host.append(p);}
 for(const row of rows){
  const card=document.createElement('article');card.className='td-card';
  const h=document.createElement('h3');h.textContent=row.name+' · '+row.levelName;
  const state=document.createElement('div');state.className='td-state';state.dataset.state=row.state;state.textContent=({OCCUPIED:'OCUPAT',FREE:'LLIURE',UNKNOWN:'DESCONEGUT'})[row.state];
  const detail=document.createElement('p');detail.className='td-muted';detail.textContent=row.reason;
  const count=document.createElement('small');count.className='td-muted';count.textContent=row.sensorCount+' detector(s) assignat(s)';
  card.append(h,state,detail,count);host.append(card);
 }
}
function openConfig(){
 const c=config(),blocks=(c.levels||[]).flatMap(l=>(l.blocks||[]).map(b=>({level:l,block:b})));
 const select=$('tdBlock');select.replaceChildren();
 for(const item of blocks){const o=document.createElement('option');o.value=String(item.level.id)+'|'+item.block.id;o.textContent=item.level.name+' · '+(item.block.name||item.block.id);select.append(o);}
 renderChoices();$('tdDialog').showModal();
}
function selectedBlock(){
 const [levelId,blockId]=String($('tdBlock').value||'').split('|');
 const level=(config().levels||[]).find(l=>String(l.id)===levelId);
 return level?{level,block:(level.blocks||[]).find(b=>b.id===blockId)}:null;
}
function renderChoices(){
 const host=$('tdSensorChoices');host.replaceChildren();const selected=selectedBlock();
 if(!selected){host.textContent='No hi ha cap bloc disponible.';return;}
 for(const sensor of selected.level.sensors||[]){
  const row=document.createElement('label');row.className='td-sensor';
  const cb=document.createElement('input');cb.type='checkbox';cb.value=sensor.id;cb.checked=(selected.block.sensorIds||[]).includes(sensor.id);
  const name=document.createElement('span');name.textContent=(sensor.userName||sensor.systemName)+' · '+sensor.systemName+(sensor.verified?' · verificat':' · pendent de verificació');
  const invert=document.createElement('input');invert.type='checkbox';invert.checked=sensor.invert===true;invert.title='Invertir lògica del detector';invert.setAttribute('aria-label','Invertir '+sensor.systemName);
  invert.addEventListener('change',()=>{sensor.invert=invert.checked;window.JMRI_TC_DISPATCHER?.checkpoint?.();window.JMRI_TC_DISPATCHER?.refresh?.();});
  row.append(cb,name,document.createTextNode(' Invertir '),invert);host.append(row);
 }
}
$('tdConfig').onclick=openConfig;$('tdRefresh').onclick=refresh;$('tdBlock').onchange=renderChoices;$('tdClose').onclick=()=>$('tdDialog').close();
$('tdAddSensor').onclick=()=>{
 const selected=selectedBlock(),systemName=$('tdSystemName').value.trim(),userName=$('tdUserName').value.trim();
 if(!selected){$('tdConfigMessage').textContent='Primer crea un bloc a l’editor.';return;}
 if(!/^[A-Za-z0-9_.:-]{1,80}$/.test(systemName)){$('tdConfigMessage').textContent='System name no vàlid.';return;}
 const all=(config().levels||[]).flatMap(l=>l.sensors||[]);
 if(all.some(s=>s.systemName===systemName)){$('tdConfigMessage').textContent='Aquest system name ja està registrat.';return;}
 window.JMRI_TC_DISPATCHER?.checkpoint?.();
 selected.level.sensors=selected.level.sensors||[];
 const sensor={id:'S-'+systemName,systemName,userName,verified:false,invert:false};
 selected.level.sensors.push(sensor);
 const requested=window.JMRI_TC_BOARD?.requestSensorReading?.(systemName);
 window.JMRI_TC_DISPATCHER?.refresh?.();$('tdSystemName').value='';$('tdUserName').value='';
 $('tdConfigMessage').textContent=requested?'Detector registrat. Sol·licitada una lectura real al servidor.':'Detector registrat; connecta el servidor per rebre lectures.';
 renderChoices();refresh();
};
$('tdSaveMapping').onclick=()=>{
 const selected=selectedBlock();if(!selected)return;
 const checked=[...$('tdSensorChoices').querySelectorAll('input[type=checkbox]')].filter(x=>x.checked).map(x=>x.value);
 window.JMRI_TC_DISPATCHER?.checkpoint?.();
 selected.block.sensorIds=checked;
 window.JMRI_TC_DISPATCHER?.refresh?.();$('tdConfigMessage').textContent='Assignació desada al projecte. El bloc continua pendent de verificació física.';refresh();
};
if(window.JMRI_TC_BOARD?.requestSensorReading){
 const request=()=>{const c=config(),names=[...new Set((c.levels||[]).flatMap(l=>(l.sensors||[]).map(s=>s.systemName)).filter(Boolean))];names.forEach(n=>window.JMRI_TC_BOARD.requestSensorReading(n));};
 request();window.setInterval(()=>{refresh();request();},2000);
}else window.setInterval(refresh,1000);
refresh();
})();
