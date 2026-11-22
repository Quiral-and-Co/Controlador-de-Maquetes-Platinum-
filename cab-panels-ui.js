(()=>{'use strict';
const $=id=>document.getElementById(id),core=window.JMRI_TC_DeadmanCore;
function initDeadman(){
 if(!core||!$('deadmanStandalonePanel'))return;
 const state=core.createState(),press=$('dmWindowPress'),release=$('dmWindowRelease'),rearm=$('dmWindowRearm');
 let timer=null;
 const lamps={BLUE:$('dmWindowBlue'),ORANGE:$('dmWindowOrange'),TRIPPED:$('dmWindowRed')};
 function stop(){if(timer)clearInterval(timer);timer=null;}
 function render(result){
  const phase=result?.phase||state.phase;
  $('dmWindowState').textContent=phase==='NORMAL'?'VIGILÀNCIA ACTIVA':phase==='BLUE'?'AVÍS BLAU':phase==='ORANGE'?'AVÍS TARONJA':phase==='TRIPPED'?'TRIP · FRENADA SIMULADA':phase;
  Object.entries(lamps).forEach(([key,node])=>node.classList.toggle('active',phase===key));
  press.disabled=state.tripped||state.pressed;release.disabled=!state.pressed;rearm.disabled=!state.tripped;
  $('dmWindowStatus').textContent=phase==='TRIPPED'?'Temps excedit. Rearmament manual després d’inspecció.':phase==='BLUE'?'Avís blau: confirma presència.':phase==='ORANGE'?'Avís taronja: confirma immediatament.':'Vigilància independent en simulació local.';
 }
 function end(){if(!state.pressed)return;render(core.release(state));}
 press.addEventListener('pointerdown',event=>{event.preventDefault();if(state.pressed||state.tripped)return;const result=core.press(state);render(result);stop();timer=setInterval(()=>{const next=core.evaluate(state);render(next);if(state.tripped)stop();},250);});
 press.addEventListener('pointerup',end);press.addEventListener('pointerleave',end);release.addEventListener('click',end);
 rearm.addEventListener('click',()=>{if(!window.confirm('Confirma inspecció i rearmament només de la simulació?'))return;core.rearm(state);render();});
 render();
}
function initStations(){
 if(!$('stationsPanel'))return;
 const stops=[];
 $('stationAdd').addEventListener('click',()=>{
  const station=$('stationName').value.trim(),platform=$('stationPlatform').value.trim(),train=$('stationTrain').value.trim(),time=$('stationTime').value;
  if(!station||!platform||!train||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){$('stationStatus').textContent='Completa estació, via, tren i hora vàlids.';return;}
  stops.push({station,platform,train,time});stops.sort((a,b)=>a.time.localeCompare(b.time));
  const list=$('stationStops');list.replaceChildren();stops.forEach(item=>{const li=document.createElement('li');li.textContent=item.time+' · '+item.station+' · '+item.platform+' · '+item.train;list.append(li);});
  $('stationStatus').textContent='Parada afegida a la planificació local. No s’ha reservat cap itinerari ni s’ha mogut cap tren.';
 });
}
function init(){initDeadman();initStations();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();