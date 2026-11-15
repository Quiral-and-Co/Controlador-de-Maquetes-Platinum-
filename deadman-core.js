'use strict';
(function(root){
 const DEFAULT_TIMEOUT_MS=2000, MIN_TIMEOUT_MS=1000, MAX_TIMEOUT_MS=10000;
 function createState(options={}){const timeoutMs=Number(options.timeoutMs??DEFAULT_TIMEOUT_MS);return{enabled:options.enabled!==false,timeoutMs:Number.isInteger(timeoutMs)&&timeoutMs>=MIN_TIMEOUT_MS&&timeoutMs<=MAX_TIMEOUT_MS?timeoutMs:DEFAULT_TIMEOUT_MS,active:false,lastHeartbeat:0,tripped:false};}
 function configure(s,enabled,timeoutMs=s.timeoutMs){if(typeof enabled!=='boolean')return{ok:false,error:'L’opció home mort ha de ser booleana.'};if(!Number.isInteger(timeoutMs)||timeoutMs<MIN_TIMEOUT_MS||timeoutMs>MAX_TIMEOUT_MS)return{ok:false,error:'El temps home mort ha d’estar entre 1000 i 10000 ms.'};s.enabled=enabled;s.timeoutMs=timeoutMs;s.active=false;s.lastHeartbeat=0;s.tripped=false;return{ok:true,state:s};}
 function engage(s,now=Date.now()){if(!s.enabled)return{ok:true,required:false};if(s.tripped)return{ok:false,error:'Home mort disparat; cal rearmament conscient.'};s.active=true;s.lastHeartbeat=now;return{ok:true,required:true};}
 function heartbeat(s,now=Date.now()){if(!s.enabled)return{ok:true,required:false};if(!s.active||s.tripped)return{ok:false,error:'No hi ha sessió home mort activa.'};s.lastHeartbeat=now;return{ok:true,required:true};}
 function release(s){s.active=false;s.lastHeartbeat=0;return{ok:true};}
 function evaluate(s,now=Date.now()){if(!s.enabled||!s.active||s.tripped)return{action:'NONE'};if(now-s.lastHeartbeat>s.timeoutMs){s.active=false;s.tripped=true;return{action:'TRIP',reason:'Home mort: s’ha perdut la confirmació de presència de l’operador.'};}return{action:'NONE'};}
 function rearm(s){s.active=false;s.lastHeartbeat=0;s.tripped=false;return{ok:true};}
 const api={DEFAULT_TIMEOUT_MS,MIN_TIMEOUT_MS,MAX_TIMEOUT_MS,createState,configure,engage,heartbeat,release,evaluate,rearm};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.JMRI_TC_DeadmanCore=api;
})(typeof window!=='undefined'?window:globalThis);
