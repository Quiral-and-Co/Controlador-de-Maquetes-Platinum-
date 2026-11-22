'use strict';
(function(root){
  const DRAG_TYPE='application/x-quiral-rolling-stock';
  const PROTOCOLS=['DCC','MFX','M4','MM2','MOTOROLA','RAILCOM','RAILCOMPLUS','OTHER'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  function ensureDatabase(value){const db=value&&typeof value==='object'&&!Array.isArray(value)?value:{};db.schemaVersion=1;db.vehicles=Array.isArray(db.vehicles)?db.vehicles:[];return db;}
  function normalizeFunctions(value){
    const rows=Array.isArray(value)?value:[];
    return rows.slice(0,69).map((fn,index)=>({number:Number.isInteger(Number(fn?.number))?Number(fn.number):index,label:String(fn?.label||('F'+index)).slice(0,80),icon:String(fn?.icon||'circle').slice(0,4*1024*1024),momentary:!!fn?.momentary,buttonType:Number.isInteger(Number(fn?.buttonType))?Number(fn.buttonType):null,durationMs:Number(fn?.durationMs)||0,position:Number(fn?.position)||0,showNumber:!!fn?.showNumber,description:String(fn?.description||'').slice(0,240),enabled:fn?.enabled!==false}));
  }
  function validateVehicle(input){
    if(!input||typeof input!=='object'||Array.isArray(input))return{ok:false,error:'Fitxa de vehicle invàlida.'};
    const name=String(input.name||'').trim(),kind=String(input.kind||'locomotive');
    if(!name||name.length>100)return{ok:false,error:'El nom és obligatori (màxim 100 caràcters).'};
    if(!['locomotive','car','multiple-unit'].includes(kind))return{ok:false,error:'Tipus de vehicle no vàlid.'};
    const protocol=String(input.protocol||'DCC').toUpperCase();
    if(!PROTOCOLS.includes(protocol))return{ok:false,error:'Protocol digital no admès.'};
    const maxKmh=input.maxKmh==null||input.maxKmh===''?null:Number(input.maxKmh);
    if(maxKmh!==null&&(!Number.isFinite(maxKmh)||maxKmh<1||maxKmh>500))return{ok:false,error:'La velocitat màxima ha d’estar entre 1 i 500 km/h.'};
    const functions=normalizeFunctions(input.functions);
    if(new Set(functions.map(fn=>fn.number)).size!==functions.length||functions.some(fn=>fn.number<0||fn.number>68))return{ok:false,error:'Les funcions han de tenir números únics entre F0 i F68.'};
    const address=String(input.address??'').trim();
    const imageRaw=String(input.image||''),image=/^(https?:\\/\\/|data:image\\/(?:png|jpeg|jpg|webp|gif);base64,)/i.test(imageRaw)?imageRaw:'';
    const cv=input.cv&&typeof input.cv==='object'&&!Array.isArray(input.cv)?clone(input.cv):{};
    return{ok:true,vehicle:{id:String(input.id||''),name,kind,manufacturer:String(input.manufacturer||'').slice(0,80),model:String(input.model||'').slice(0,100),article:String(input.article||'').slice(0,80),protocol,address,addressType:String(input.addressType||'auto'),decoder:String(input.decoder||'').slice(0,100),maxKmh,image,drawing:String(input.drawing||''),functions,cv,source:String(input.source||'MANUAL'),sourceId:String(input.sourceId||''),identity:String(input.identity||''),metadata:input.metadata&&typeof input.metadata==='object'?clone(input.metadata):{},updatedAt:Number(input.updatedAt)||Date.now()}};}
  function upsertVehicle(database,input){
    const db=ensureDatabase(database),valid=validateVehicle(input);if(!valid.ok)return valid;
    const v=valid.vehicle;if(!v.id)v.id='RS-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
    const existing=db.vehicles.findIndex(x=>x.id===v.id);
    const duplicate=db.vehicles.find(x=>x.id!==v.id&&v.identity&&x.identity===v.identity);
    if(duplicate)return{ok:false,error:'Ja existeix un vehicle amb la mateixa identitat digital ('+duplicate.name+').',duplicate};
    if(existing>=0)db.vehicles[existing]={...db.vehicles[existing],...v};else db.vehicles.push(v);
    return{ok:true,vehicle:existing>=0?db.vehicles[existing]:v,updated:existing>=0};
  }
  function removeVehicle(database,id,{activeIds=[]}={}){
    const db=ensureDatabase(database),vehicle=db.vehicles.find(v=>v.id===id);
    if(!vehicle)return{ok:false,error:'Vehicle no trobat.'};
    if(activeIds.includes(id))return{ok:false,error:'No es pot eliminar un vehicle amb una circulació activa.'};
    db.vehicles=db.vehicles.filter(v=>v.id!==id);return{ok:true};
  }
  function buildInventory(locomotives=[],roster={},database={}){
    const db=ensureDatabase(database),byId=new Map();
    for(const v of db.vehicles){byId.set(v.id,{...v,kind:v.kind==='car'?'car':v.kind,controlReady:false,draggable:false});}
    for(const item of Array.isArray(locomotives)?locomotives:[]){
      const found=[...byId.values()].find(v=>v.id===String(item.id)|| (v.address&&v.address===String(item.address||item.wiThrottleId||'')));
      const merged={...(found||{}),id:String(item.id||found?.id||''),name:String(found?.name||item.name||'Locomotora sense nom'),kind:'locomotive',type:'LOCOMOTIVE',address:String(found?.address||item.address||item.wiThrottleId||''),protocol:found?.protocol||item.protocol||'DCC',controlReady:true,draggable:true};
      if(merged.id){if(found&&found.id!==merged.id)byId.delete(found.id);byId.set(merged.id,merged);}
    }
    const cars=(Array.isArray(roster?.cars)?roster.cars:[]).map(item=>({id:String(item.id||''),name:String(item.name||'Vehicle sense nom'),kind:'car',type:String(item.type||'PASSENGER'),address:'',draggable:false,attached:!!(item.trainId||item.trainSetId)})).filter(item=>item.id);
    for(const car of cars)if(!byId.has(car.id))byId.set(car.id,car);
    return [...byId.values()];
  }
  function createDragPayload(item){if(!item||!['locomotive','multiple-unit'].includes(item.kind)||item.controlReady===false||typeof item.id!=='string'||!item.id)return '';return JSON.stringify({schema:1,kind:item.kind,id:item.id});}
  function resolveDrop(raw,locomotives=[]){let payload;try{payload=JSON.parse(String(raw||''));}catch{return{ok:false,error:'Dades d’arrossegament no vàlides.'};}if(!payload||payload.schema!==1||typeof payload.id!=='string'||!payload.id)return{ok:false,error:'Identificador de vehicle no vàlid.'};if(!['locomotive','multiple-unit'].includes(payload.kind))return{ok:false,error:'Només es poden deixar anar locomotores al control DMI.'};const locomotive=(Array.isArray(locomotives)?locomotives:[]).find(item=>item?.id===payload.id);if(!locomotive)return{ok:false,error:'La locomotora no està habilitada al registre de control actual.'};return{ok:true,locomotive};}
  const api={DRAG_TYPE,PROTOCOLS,ensureDatabase,normalizeFunctions,validateVehicle,upsertVehicle,removeVehicle,buildInventory,createDragPayload,resolveDrop};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.JMRI_TC_RollingStockCore=api;
})(typeof window!=='undefined'?window:globalThis);
