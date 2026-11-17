'use strict';
const MAX_EVENTS=500;
function createState(){return {latched:true,reason:'Inicialització segura',source:'startup',triggeredAt:new Date().toISOString(),events:[],generation:0};}
function record(state,event,now=new Date()){
 const item={id:state.events.length+1,generation:state.generation,type:event.type,reason:String(event.reason||''),source:String(event.source||'unknown'),at:now.toISOString()};
 state.events.push(item);if(state.events.length>MAX_EVENTS)state.events.splice(0,state.events.length-MAX_EVENTS);return item;
}
function trip(state,{reason,source='operator'}={},now=new Date()){
 if(!state.latched){state.latched=true;state.reason=String(reason||'Emergència activada');state.source=source;state.triggeredAt=now.toISOString();state.generation++;}
 const event=record(state,{type:'TRIP',reason:state.reason,source:state.source},now);
 return {ok:true,latched:true,event,generation:state.generation};
}
function canRearm(state,conditions={}){
 const missing=[];
 if(!state.latched)missing.push('No hi ha cap emergència activa');
 if(conditions.operatorConfirmed!==true)missing.push('Cal confirmació manual de l’operador');
 if(conditions.jmriConnected!==true)missing.push('JMRI no està connectat');
 if(conditions.bridgeConnected!==true)missing.push('Pont WiThrottle no està connectat');
 if(conditions.jmriPower!=='OFF')missing.push('La CS2 no confirma alimentació OFF');
 if(conditions.allRunsStopped!==true)missing.push('Hi ha circulacions que no consten aturades');
 return {ok:missing.length===0,missing};
}
function rearm(state,conditions={},now=new Date()){
 const gate=canRearm(state,conditions);if(!gate.ok)return {ok:false,latched:true,missing:gate.missing};
 state.latched=false;state.reason='';state.source='operator-rearm';state.generation++;
 const event=record(state,{type:'REARM',reason:'Rearmament manual; DCC continua desarmat',source:'operator'},now);
 return {ok:true,latched:false,event,generation:state.generation,dccArmed:false};
}
function snapshot(state){return {latched:state.latched,reason:state.reason,source:state.source,triggeredAt:state.triggeredAt,generation:state.generation,events:state.events.map(x=>({...x}))};}
module.exports={createState,trip,canRearm,rearm,snapshot,record};
