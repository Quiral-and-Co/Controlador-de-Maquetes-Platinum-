(() => {
'use strict';
const core=window.JMRI_TC_LocomotiveDmiCore;if(!core)return;
const $=id=>document.getElementById(id);
let maxKmh=160,setpoint=0,currentStep=0,direction=1,functions=new Set(),dragging=false;
const ASPECTS=window.JMRI_TC_SignallingCore?.ASPECTS||{};
function traffic(){return window.JMRI_TC_TRAFFIC_CONTROL;}
function routeFor(snapshot){return snapshot?.activeRun?((snapshot.config?.dispatcher?.routes||[]).find(r=>r.id===snapshot.activeRun.routeId)||null):null;}
function activeLoco(snapshot){return snapshot?.locomotives?.find(l=>l.id===snapshot.activeRun?.locomotiveId)||snapshot?.locomotives?.find(l=>l.id===$('dmiLocomotive')?.value)||null;}
function setStatus(message){const node=$('dmiCommandStatus');if(node)node.textContent=message;}
function setDial(value){setpoint=core.clamp(value,0,maxKmh);$('dmiSetpointValue').textContent=Math.round(setpoint);$('dmiSetpointDial').setAttribute('aria-valuenow',String(Math.round(setpoint)));$('dmiSetpointDial').setAttribute('aria-valuetext',Math.round(setpoint)+' km/h');const angle=core.needleAngle(setpoint,maxKmh);$('dmiSetpointNeedle').setAttribute('transform','rotate('+angle+' 90 90)');$('dmiSetpointArc').style.strokeDasharray=(setpoint/maxKmh*240)+' 240';}
function renderSpeed(){
 const kmh=core.stepToKmh(currentStep,maxKmh),angle=core.needleAngle(kmh,maxKmh);
 $('dmiSpeedValue').textContent=String(Math.round(kmh));$('dmiSpeedScale').textContent='0 — '+maxKmh+' km/h';
 $('dmiNeedle').setAttribute('transform','rotate('+angle+' 160 150)');
 $('dmiLinearSpeed').max=String(maxKmh);$('dmiLinearSpeed').value=String(Math.round(setpoint));$('dmiLinearValue').textContent=Math.round(setpoint)+' km/h';
 setDial(setpoint);
}
function setTarget(value,send=true){
 setpoint=core.clamp(value,0,maxKmh);$('dmiLinearSpeed').value=String(Math.round(setpoint));setDial(setpoint);
 if(send){const step=core.kmhToStep(setpoint,maxKmh),api=traffic();if(!api?.setSpeed){setStatus('Comandament no disponible: cal una circulació manual activa.');return;}api.setSpeed(step);currentStep=step;renderSpeed();setStatus('Consigna enviada: '+Math.round(setpoint)+' km/h (pas DCC '+step+'/126). La velocitat real requereix telemetria calibrada.');}
}
function dialValue(event){
 const rect=$('dmiSetpointDial').getBoundingClientRect(),x=event.clientX-(rect.left+rect.width/2),y=event.clientY-(rect.top+rect.height/2);
 let angle=Math.atan2(y,x)*180/Math.PI+90;if(angle<0)angle+=360;
 angle=core.clamp(angle,0,270);return angle/270*maxKmh;
}
function updateLocomotives(snapshot){
 const select=$('dmiLocomotive'),previous=select.value;select.replaceChildren();
 (snapshot?.locomotives||[]).forEach(l=>{const option=document.createElement('option');option.value=l.id;option.textContent=l.name+' · '+l.wiThrottleId;select.append(option);});
 const active=snapshot?.activeRun?.locomotiveId;
 if(active)select.value=active;else if((snapshot?.locomotives||[]).some(l=>l.id===previous))select.value=previous;
 select.disabled=!!active;
}
function renderSignals(snapshot){
 const host=$('dmiSignals');host.replaceChildren();const route=routeFor(snapshot),chain=core.signalChain(snapshot?.config?.signals,route);
 if(!chain.length){const p=document.createElement('p');p.className='dmi-muted';p.textContent='Sense senyals vinculades a l’itinerari actiu.';host.append(p);return;}
 chain.forEach((signal,index)=>{
  const card=document.createElement('article');card.className='dmi-signal-card';
  const title=document.createElement('strong');title.textContent=(index?'Següent senyal':'Senyal immediata')+' · '+(signal.name||signal.id);
  const type=document.createElement('span');type.textContent=(window.JMRI_TC_SignallingCore?.TYPES?.[signal.type]||signal.type||'Tipus no definit');
  const aspect=document.createElement('span');aspect.className='dmi-aspect';aspect.dataset.aspect=signal.computedAspect||signal.aspect||'PARADA';aspect.textContent=core.normalizeAspect(signal,ASPECTS);
  const distance=document.createElement('span');distance.className='dmi-distance';
  let meters=null;try{meters=window.JMRI_TC_TRAIN_POSITION?.getDistanceToSignal?.(signal.id);}catch{}
  distance.textContent=core.distanceLabel(meters);
  card.append(title,type,aspect,distance);host.append(card);
 });
}
function renderTurnouts(snapshot){
 const host=$('dmiTurnouts');host.replaceChildren();const route=routeFor(snapshot);
 if(!route){host.textContent='Sense itinerari actiu.';return;}
 const c=snapshot.config||{},telemetry=window.JMRI_TC_BOARD?.getTelemetry?.()||{},accessories=window.JMRI_TC_DIGITAL_CATALOGUE?.getDatabase?.().accessories||[];
 const supervisor=window.JMRI_TC_TURNOUT_SUPERVISION;
 const requirements=supervisor?.inspectRoute?.(route)?.requirements||window.JMRI_TC_TurnoutSupervisionCore?.routeRequirements(route,c)||[];
 if(!requirements.length){host.textContent='L’itinerari no declara desviaments.';return;}
 requirements.forEach(req=>{const row=document.createElement('div');row.className='dmi-turnout-row';const name=document.createElement('strong');name.textContent=req.systemName;const state=document.createElement('span');state.textContent=core.turnoutLabel(telemetry.turnouts?.[req.systemName]);const expected=document.createElement('small');expected.textContent='Requerida: '+core.turnoutLabel(req.requiredState);row.append(name,state,expected);host.append(row);});
}
function refresh(){
 const api=traffic();if(!api)return;const snapshot=api.getSnapshot();updateLocomotives(snapshot);
 const loco=activeLoco(snapshot);$('dmiLocoName').textContent=loco?.name||'Cap locomotora seleccionada';
 const run=snapshot.activeRun;
 const safe=!!run&&run.status==='RUNNING'&&run.mode==='MANUAL'&&snapshot.bridgeConnected&&snapshot.dccArmed&&snapshot.deadmanHeld&&snapshot.safetyReady;
 $('dmiSafetyState').textContent=safe?'CONDUCCIÓ SUPERVISADA':'CONTROL BLOQUEJAT · '+(run?'verifica DCC, home mort i interbloqueigs':'inicia una circulació manual');
 $('dmiSafetyState').className=safe?'dmi-safety ready':'dmi-safety locked';
 const controls=$('dmiFunctionButtons');if(controls)controls.querySelectorAll('button').forEach(b=>b.disabled=!safe);
 $('dmiDirection').disabled=!safe;$('dmiLinearSpeed').disabled=!safe;$('dmiSetpointDial').setAttribute('aria-disabled',String(!safe));
 renderSignals(snapshot);renderTurnouts(snapshot);
}
function init(){
 if(!$('locomotiveDmiPanel'))return;
 $('dmiMaxSpeed').value=String(maxKmh);
 $('dmiApplyMax').onclick=()=>{const result=core.validateCalibration($('dmiMaxSpeed').value);if(!result.ok){setStatus(result.error);return;}maxKmh=result.maxKmh;setpoint=core.clamp(setpoint,0,maxKmh);currentStep=core.kmhToStep(currentStep/126*maxKmh,maxKmh);renderSpeed();setStatus('Escala DMI configurada a '+maxKmh+' km/h. Ajusta-la amb dades de calibratge reals de la locomotora.');};
 $('dmiLinearSpeed').oninput=e=>setTarget(e.target.value);
 $('dmiDirection').onclick=()=>{direction=direction===1?0:1;const api=traffic();api?.setDirection?.(direction);$('dmiDirection').textContent=direction===1?'▶ ENDAVANT':'◀ ENRERE';setStatus('Canvi de sentit sol·licitat. Verifica que la locomotora està aturada abans d’invertir.');};
 $('dmiSetpointDial').addEventListener('pointerdown',e=>{if($('dmiSetpointDial').getAttribute('aria-disabled')==='true')return;dragging=true;$('dmiSetpointDial').setPointerCapture?.(e.pointerId);setTarget(dialValue(e));});
 $('dmiSetpointDial').addEventListener('pointermove',e=>{if(dragging)setTarget(dialValue(e));});
 $('dmiSetpointDial').addEventListener('pointerup',()=>{dragging=false;});
 $('dmiSetpointDial').addEventListener('pointercancel',()=>{dragging=false;});
 $('dmiSetpointDial').addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowRight'){e.preventDefault();setTarget(setpoint+1);}else if(e.key==='ArrowDown'||e.key==='ArrowLeft'){e.preventDefault();setTarget(setpoint-1);}else if(e.key==='Home'){e.preventDefault();setTarget(0);}});
 $('dmiFunctionButtons').addEventListener('click',e=>{const button=e.target.closest('button[data-function]');if(!button)return;const fn=Number(button.dataset.function),enabled=!functions.has(fn);if(traffic()?.setFunction?.(fn,enabled)){if(enabled)functions.add(fn);else functions.delete(fn);button.setAttribute('aria-pressed',String(enabled));button.classList.toggle('active',enabled);}});
 $('dmiLocomotive').onchange=()=>{const source=$('trafficLoco');if(source)source.value=$('dmiLocomotive').value;};
 renderSpeed();refresh();setInterval(refresh,1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.JMRI_TC_LOCOMOTIVE_DMI={refresh,setTarget,getCalibration:()=>({maxKmh})};
})();