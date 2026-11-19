'use strict';
(function(root){
 const MAX_BLOCKS=64;
 function buildGraph(routes){
  const graph=new Map();
  for(const route of routes||[]){
   const ids=(route.blockIds||[]).map(String);
   if(ids.length<2)continue;
   for(let i=0;i<ids.length-1;i++){
    const a=ids[i],b=ids[i+1];
    if(!graph.has(a))graph.set(a,[]);
    if(!graph.has(b))graph.set(b,[]);
    const requirements=Array.isArray(route.turnoutRequirements)?route.turnoutRequirements.map(x=>({systemName:String(x.systemName||''),requiredState:String(x.requiredState||x.requiredPosition||'').toUpperCase()})):[];
    graph.get(a).push({to:b,requirements,routeId:String(route.id||'')});
   }
  }
  for(const edges of graph.values())edges.sort((a,b)=>a.to.localeCompare(b.to));
  return graph;
 }
 function shortestPath(routes,from,to){
  const start=String(from||''),target=String(to||'');
  if(!start||!target||start===target)return{ok:false,error:'Selecciona dos blocs diferents.'};
  const graph=buildGraph(routes),queue=[start],previous=new Map([[start,null]]),edgeByNode=new Map();
  while(queue.length){
   const node=queue.shift();if(node===target)break;
   for(const edge of graph.get(node)||[])if(!previous.has(edge.to)){previous.set(edge.to,node);edgeByNode.set(edge.to,edge);queue.push(edge.to);}
  }
  if(!previous.has(target))return{ok:false,error:'No hi ha cap connexió topològica coneguda entre aquests dos blocs. Defineix primer les connexions/itineraris.'};
  const blockIds=[];let cursor=target;while(cursor!==null){blockIds.push(cursor);cursor=previous.get(cursor);}blockIds.reverse();
  if(blockIds.length>MAX_BLOCKS)return{ok:false,error:'La ruta supera el límit de '+MAX_BLOCKS+' blocs.'};
  const requirements=new Map();
  for(let i=1;i<blockIds.length;i++)for(const req of edgeByNode.get(blockIds[i])?.requirements||[]){
   if(!req.systemName||!['CLOSED','THROWN','2','4'].includes(req.requiredState))return{ok:false,error:'La ruta conté un requisit de desviament incomplet.'};
   const old=requirements.get(req.systemName);if(old&&old.requiredState!==req.requiredState)return{ok:false,error:'La ruta exigeix posicions incompatibles per al desviament '+req.systemName+'.'};
   requirements.set(req.systemName,req);
  }
  return{ok:true,blockIds,turnoutRequirements:[...requirements.values()]};
 }
 function validatePlan(input){
  const path=(input?.blockIds||[]).map(String),snapshot=input?.snapshot||{},blocks=snapshot.blocks||[],states=snapshot.blockStates||{},reservations=snapshot.reservations||{};
  if(input?.editMode===true)return{ok:false,error:'AutoTrain no està disponible en mode d’edició.'};
  if(path.length<2||path.length>MAX_BLOCKS)return{ok:false,error:'La ruta no és vàlida.'};
  const byId=new Map(blocks.map(b=>[String(b.id),b]));
  if(states[path[0]]!=='OCCUPIED')return{ok:false,error:'El bloc d’origen no consta ocupat per un tren.'};
  for(let i=0;i<path.length;i++){
   const id=path[i],block=byId.get(id),status=states[id]||'UNKNOWN';
   if(!block||block.verified!==true||!Array.isArray(block.sensorIds)||!block.sensorIds.length)return{ok:false,error:'Bloc '+id+' sense verificació o detectors assignats.'};
   if(i===0){if(status!=='OCCUPIED')return{ok:false,error:'El bloc d’origen no està ocupat.'};}
   else if(status!=='FREE')return{ok:false,error:'Bloc '+id+' no confirmat lliure ('+status+').'};
   if(reservations[id])return{ok:false,error:'Bloc '+id+' ja està reservat.'};
  }
  if(input?.locomotiveId===undefined||input?.locomotiveId===null||String(input.locomotiveId)==='')return{ok:false,error:'Selecciona una locomotora registrada.'};
  if(input?.speedProfileVerified!==true)return{ok:false,error:'La locomotora no té un perfil de velocitat calibrat i verificat.'};
  if(input?.sourceConfirmed!==true)return{ok:false,error:'Confirma que la locomotora seleccionada és físicament al bloc d’origen.'};
  return{ok:true,blockIds:path};
 }
 const api={MAX_BLOCKS,buildGraph,shortestPath,validatePlan};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.JMRI_TC_AUTOTRAIN_CORE=api;
})(typeof window!=='undefined'?window:globalThis);
