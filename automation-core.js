'use strict';

// Deterministic timetable planner. It never sends locomotive or accessory commands.
const MAX_SCHEDULE_SPEED = 20;
function parseClock(value) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}
function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
function validateSchedule(input, routes, locomotives) {
  if (!input || typeof input !== 'object') return {ok:false,error:'Horari invàlid.'};
  const id=String(input.id||'').trim(), name=String(input.name||'').trim();
  if (!id || !name) return {ok:false,error:'L’horari necessita identificador i nom.'};
  if (!routes.some(r=>r.id===input.routeId)) return {ok:false,error:'L’itinerari seleccionat no existeix.'};
  if (!locomotives.some(l=>l.id===input.locomotiveId)) return {ok:false,error:'La locomotora seleccionada no existeix.'};
  if (parseClock(input.startTime)===null) return {ok:false,error:'L’hora ha de tenir el format HH:mm.'};
  if (!Array.isArray(input.days) || !input.days.length || input.days.some(d=>!Number.isInteger(d)||d<0||d>6)) return {ok:false,error:'Selecciona almenys un dia vàlid (0 diumenge – 6 dissabte).'};
  if (new Set(input.days).size!==input.days.length) return {ok:false,error:'No es poden repetir dies.'};
  const speed=Number(input.maxSpeed);
  if (!Number.isInteger(speed)||speed<1||speed>MAX_SCHEDULE_SPEED) return {ok:false,error:'La velocitat programada ha d’estar entre 1 i 20 passos.'};
  const windowMinutes=input.windowMinutes===undefined?2:Number(input.windowMinutes);
  if (!Number.isInteger(windowMinutes)||windowMinutes<1||windowMinutes>15) return {ok:false,error:'La finestra d’inici ha d’estar entre 1 i 15 minuts.'};
  return {ok:true,schedule:{id,name,routeId:input.routeId,locomotiveId:input.locomotiveId,startTime:input.startTime,days:[...input.days].sort((a,b)=>a-b),maxSpeed:speed,windowMinutes,enabled:input.enabled!==false,requiredTurnouts:Array.isArray(input.requiredTurnouts)?input.requiredTurnouts.map(t=>({systemName:String(t.systemName||''),state:t.state,verified:t.verified===true})):[]}};
}
function createState(){return {schedules:[],executions:[]};}
function addSchedule(state,input,routes,locomotives){
  const checked=validateSchedule(input,routes,locomotives); if(!checked.ok)return checked;
  if(state.schedules.some(s=>s.id===checked.schedule.id))return {ok:false,error:'Ja existeix un horari amb aquest identificador.'};
  state.schedules.push(checked.schedule); return {ok:true,schedule:checked.schedule};
}
function evaluateSchedule(schedule,now,safety,alreadyClaimed=false){
  if(!schedule||!schedule.enabled)return {status:'DISABLED',reason:'Horari desactivat.'};
  if(!(now instanceof Date)||Number.isNaN(now.getTime()))return {status:'BLOCKED',reason:'Data/hora invàlida.'};
  if(alreadyClaimed)return {status:'ALREADY_CLAIMED',reason:'Aquest horari ja s’ha activat avui.'};
  if(!schedule.days.includes(now.getDay()))return {status:'WAIT',reason:'Avui no és un dia programat.'};
  const target=parseClock(schedule.startTime); if(target===null)return {status:'BLOCKED',reason:'Hora programada invàlida.'};
  const current=now.getHours()*60+now.getMinutes(),delta=current-target;
  if(delta<0)return {status:'WAIT',reason:'Encara no és l’hora programada.'};
  if(delta>schedule.windowMinutes)return {status:'MISSED',reason:'S’ha superat la finestra d’inici.'};
  if(!safety||!safety.jmriConnected)return {status:'BLOCKED',reason:'JMRI no està connectat.'};
  if(safety.jmriPower!=='ON')return {status:'BLOCKED',reason:'L’alimentació JMRI no està confirmada com a ON.'};
  if(!safety.bridgeConnected||!safety.dccArmed)return {status:'BLOCKED',reason:'WiThrottle desconnectat o DCC no armat.'};
  if(!safety.sensorDataValid)return {status:'BLOCKED',reason:'Les lectures de sensors no són vàlides.'};
  const route=safety.route;
  if(!route||!Array.isArray(route.blockIds)||route.blockIds.length<2)return {status:'BLOCKED',reason:'Itinerari invàlid.'};
  const states=safety.blockStates||{};
  if(states[route.blockIds[0]]!=='OCCUPIED')return {status:'BLOCKED',reason:'El primer bloc no està confirmat com a ocupat.'};
  for(const id of route.blockIds.slice(1))if(states[id]!=='FREE')return {status:'BLOCKED',reason:'El bloc '+id+' no està confirmat com a lliure.'};
  const turnoutStates=safety.turnoutStates||{};
  for(const required of schedule.requiredTurnouts||[]){
    const actual=turnoutStates[required.systemName];
    if(!required.systemName||required.verified!==true||!actual||actual.verified!==true||actual.state!==required.state)
      return {status:'BLOCKED',reason:'Desviament '+(required.systemName||'(sense nom)')+' no verificat o no alineat.'};
  }
  return {status:'READY',reason:'Horari validat. Cal confirmació explícita de l’operador per iniciar la circulació.'};
}
function claimExecution(state,scheduleId,now,safety){
  const schedule=state.schedules.find(s=>s.id===scheduleId);
  if(!schedule)return {ok:false,error:'Horari inexistent.'};
  const key=dateKey(now);
  const duplicate=state.executions.some(x=>x.scheduleId===scheduleId&&x.date===key);
  const decision=evaluateSchedule(schedule,now,safety,duplicate);
  if(decision.status!=='READY')return {ok:false,status:decision.status,error:decision.reason};
  const execution={id:'SCH-'+scheduleId+'-'+key,scheduleId,date:key,status:'CLAIMED',createdAt:now.getTime(),reason:decision.reason};
  state.executions.push(execution);
  return {ok:true,execution,decision};
}
function completeExecution(state,executionId){
  const item=state.executions.find(x=>x.id===executionId);
  if(!item||item.status!=='CLAIMED')return {ok:false,error:'Execució no disponible per completar.'};
  item.status='COMPLETED'; item.completedAt=Date.now(); return {ok:true,execution:item};
}
function failExecution(state,executionId,reason){
  const item=state.executions.find(x=>x.id===executionId);
  if(!item||item.status!=='CLAIMED')return {ok:false,error:'Execució no disponible per marcar com a fallida.'};
  item.status='FAULT'; item.fault=String(reason||'Fallada sense detall'); return {ok:true,execution:item};
}
module.exports={MAX_SCHEDULE_SPEED,parseClock,dateKey,validateSchedule,createState,addSchedule,evaluateSchedule,claimExecution,completeExecution,failExecution};
