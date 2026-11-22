'use strict';
(function(root){
  const DRAG_TYPE='application/x-quiral-rolling-stock';
  function buildInventory(locomotives=[],roster={}){
    const engines=(Array.isArray(locomotives)?locomotives:[]).map(item=>({id:String(item.id||''),name:String(item.name||'Locomotora sense nom'),kind:'locomotive',type:'LOCOMOTIVE',address:String(item.wiThrottleId||''),draggable:true})).filter(item=>item.id);
    const cars=(Array.isArray(roster?.cars)?roster.cars:[]).map(item=>({id:String(item.id||''),name:String(item.name||'Vehicle sense nom'),kind:'car',type:String(item.type||'PASSENGER'),address:'',draggable:true,attached:!!(item.trainId||item.trainSetId)})).filter(item=>item.id);
    return [...engines,...cars];
  }
  function createDragPayload(item){
    if(!item||!['locomotive','car'].includes(item.kind)||typeof item.id!=='string'||!item.id)return '';
    return JSON.stringify({schema:1,kind:item.kind,id:item.id});
  }
  function resolveDrop(raw,locomotives=[]){
    let payload;try{payload=JSON.parse(String(raw||''));}catch{return{ok:false,error:'Dades d’arrossegament no vàlides.'};}
    if(!payload||payload.schema!==1||typeof payload.id!=='string'||!payload.id)return{ok:false,error:'Identificador de vehicle no vàlid.'};
    if(payload.kind!=='locomotive')return{ok:false,error:'Només es poden deixar anar locomotores al control DMI.'};
    const locomotive=(Array.isArray(locomotives)?locomotives:[]).find(item=>item?.id===payload.id);
    if(!locomotive)return{ok:false,error:'La locomotora ja no existeix al registre actual.'};
    return{ok:true,locomotive};
  }
  const api={DRAG_TYPE,buildInventory,createDragPayload,resolveDrop};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.JMRI_TC_RollingStockCore=api;
})(typeof window!=='undefined'?window:globalThis);
