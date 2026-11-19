'use strict';
(function(root){
 const TYPES=['DISTANCE','TIME','LOGIC'],ACTIONS=['BRAKE_REQUEST','STOP_REQUEST','LOGIC_EVENT'];
 function normalizeDefinition(input,blocks,sensors){
  const x=input||{},id=String(x.id||'').trim(),blockId=String(x.blockId||'').trim(),name=String(x.name||'').trim(),type=String(x.trigger?.type||'').toUpperCase(),action=String(x.action||'LOGIC_EVENT').toUpperCase();
  if(!/^[A-Za-z0-9_.:-]{1,80}$/.test(id))return{ok:false,error:'Identificador de contacte virtual invàlid.'};
  const block=(blocks||[]).find(b=>String(b.id)===blockId);
  if(!block||block.verified!==true||!Number.isFinite(Number(block.lengthMm))||Number(block.lengthMm)<=0)return{ok:false,error:'El bloc ha d’estar verificat i tenir una longitud vàlida.'};
  if(!name||name.length>80)return{ok:false,error:'Introdueix un nom de fins a 80 caràcters.'};
  if(!TYPES.includes(type)||!ACTIONS.includes(action))return{ok:false,error:'Tipus de disparador o acció no vàlid.'};
  const trigger={type};
  if(type==='DISTANCE'){
   const mm=Number(x.trigger.distanceMm);
   if(!Number.isFinite(mm)||mm<=0||mm>=Number(block.lengthMm))return{ok:false,error:'La distància ha d’estar dins del bloc i abans del seu final.'};
   trigger.distanceMm=mm;
  }else if(type==='TIME'){
   const seconds=Number(x.trigger.seconds);
   if(!Number.isFinite(seconds)||seconds<=0||seconds>3600)return{ok:false,error:'El temps ha d’estar entre 1 i 3600 segons.'};
   trigger.seconds=seconds;
  }else{
   const operator=String(x.trigger.operator||'AND').toUpperCase(),conditions=Array.isArray(x.trigger.conditions)?x.trigger.conditions:[];
   if(!['AND','OR'].includes(operator)||!conditions.length||conditions.length>16)return{ok:false,error:'Defineix entre 1 i 16 condicions lògiques.'};
   const normalized=[];
   for(const c of conditions){
    const sensor=(sensors||[]).find(s=>s.systemName===String(c.systemName||'')&&s.verified===true);
    const expected=String(c.state||'').toUpperCase();
    if(!sensor||!['ACTIVE','INACTIVE'].includes(expected))return{ok:false,error:'Les condicions només poden utilitzar detectors reals verificats i estats coneguts.'};
    normalized.push({systemName:sensor.systemName,state:expected});
   }
   trigger.operator=operator;trigger.conditions=normalized;
  }
  return{ok:true,contact:{id,blockId,name,kind:'VIRTUAL',address:null,verified:false,enabled:x.enabled!==false,trigger,action,routeIds:Array.isArray(x.routeIds)?x.routeIds.map(String):[],trainTypes:Array.isArray(x.trainTypes)?x.trainTypes.map(String):[]}};
 }
 function evaluate(contact,context={}){
  if(!contact||contact.kind!=='VIRTUAL'||contact.enabled===false)return{active:false,state:'INACTIVE',reason:'Contacte desactivat.'};
  if(contact.trigger?.type==='DISTANCE'){
   const p=context.positionEstimate;
   if(!p||p.verified!==true||p.profileVerified!==true||String(p.blockId)!==String(contact.blockId)||!Number.isFinite(Number(p.positionMm)))return{active:false,state:'UNKNOWN',reason:'Cal una estimació de posició verificada dins del bloc.'};
   return Number(p.positionMm)>=Number(contact.trigger.distanceMm)?{active:true,state:'ACTIVE',reason:'Distància virtual assolida.',action:contact.action}:{active:false,state:'INACTIVE',reason:'Encara no s’ha assolit la distància.'};
  }
  if(contact.trigger?.type==='TIME'){
   const p=context.positionEstimate;
   if(!p||p.verified!==true||p.profileVerified!==true||String(p.blockId)!==String(contact.blockId)||!Number.isFinite(Number(p.elapsedSeconds)))return{active:false,state:'UNKNOWN',reason:'Cal un temps d’entrada al bloc verificat i un perfil calibrat.'};
   return Number(p.elapsedSeconds)>=Number(contact.trigger.seconds)?{active:true,state:'ACTIVE',reason:'Temps virtual assolit.',action:contact.action}:{active:false,state:'INACTIVE',reason:'Encara no s’ha assolit el temps.'};
  }
  if(contact.trigger?.type==='LOGIC'){
   const conditions=contact.trigger.conditions||[],states=context.sensorStates||{};
   if(!conditions.length)return{active:false,state:'UNKNOWN',reason:'No hi ha condicions lògiques.'};
   const values=conditions.map(c=>{const v=states[c.systemName];return v==='ACTIVE'||v==='INACTIVE'?v===c.state:null;});
   if(values.some(v=>v===null))return{active:false,state:'UNKNOWN',reason:'Hi ha detectors sense lectura vàlida.'};
   const active=contact.trigger.operator==='OR'?values.some(Boolean):values.every(Boolean);
   return{active,state:active?'ACTIVE':'INACTIVE',reason:active?'Condicions lògiques satisfetes.':'Condicions lògiques no satisfetes.',action:contact.action};
  }
  return{active:false,state:'UNKNOWN',reason:'Disparador desconegut.'};
 }
 function inspect(config,context={}){
  const rows=[];
  for(const level of config?.levels||[])for(const contact of level.virtualContacts||[]){
   const result=evaluate(contact,{...context,positionEstimate:context.positionEstimates?.[contact.blockId]||context.positionEstimate});
   rows.push({levelId:level.id,levelName:level.name||String(level.id),...contact,...result});
  }
  return rows;
 }
 const api={TYPES,ACTIONS,normalizeDefinition,evaluate,inspect};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.JMRI_TC_VIRTUAL_CONTACT_CORE=api;
})(typeof window!=='undefined'?window:globalThis);
