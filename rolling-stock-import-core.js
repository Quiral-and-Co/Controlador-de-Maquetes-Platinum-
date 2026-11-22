'use strict';
(function(root){
  const clean=(v,max=160)=>String(v??'').trim().slice(0,max);
  const parseAddress=v=>{const s=clean(v,32);if(!s)return'';if(/^0x[0-9a-f]+$/i.test(s))return String(parseInt(s,16));return s;};
  function parseCs2(text){
    const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/),records=[];let current=null,section='';
    for(const raw of lines){const line=raw.trim();if(!line||line.startsWith('#')||line.startsWith(';'))continue;
      if(line.startsWith('[')&&line.endsWith(']')){section=line.slice(1,-1).toLowerCase();if(section==='lokomotive'){if(current)records.push(current);current={functions:[],_function:null,_section:section};}continue;}
      if(!current)continue;
      const m=line.match(/^(\.*)([^=]+)=(.*)$/);if(!m)continue;
      const depth=m[1].length,key=m[2].trim().toLowerCase(),value=m[3].trim();
      if(depth===1&&key==='funktionen'){current._section='functions';current._function=null;continue;}
      if(depth===2&&key==='nr'){current._function={number:Number(value),label:'F'+value,icon:Number(value)===0?'lightbulb':'circle',momentary:false};current.functions.push(current._function);continue;}
      if(depth===2&&current._function){if(key==='typ')current._function.type=value;else if(key==='dauer')current._function.momentary=Number(value)>0;else if(key==='wert')current._function.value=value;else if(key==='symbol'||key==='icon')current._function.icon=value;else if(key==='name'||key==='bezeichnung')current._function.label=value;continue;}
      if(depth===1){current[key]=value;if(key==='name')current.name=value;}
    }
    if(current)records.push(current);
    return records.filter(r=>r.name||r.adresse).map((r,i)=>({id:'CS2-'+clean(r.uid||r.mfxuid||r.adresse||i,48),name:clean(r.name||r.vorname||'Locomotora CS2'),kind:'locomotive',manufacturer:'Märklin',protocol:(clean(r.typ,'20').toUpperCase().includes('MFX')||r.mfxuid&&r.mfxuid!=='0xffffffff'?'MFX':['MM','MM2','MOTOROLA'].includes(clean(r.typ,'20').toUpperCase())?'MM2':'DCC'),address:parseAddress(r.adresse),addressType:'auto',decoder:'',image:'',drawing:clean(r.icon,256),functions:r.functions||[],maxKmh:r.tachomax?Number(r.tachomax):null,source:'MARKLIN_CS2_FILE',sourceId:clean(r.uid||r.mfxuid||r.adresse||i,64),identity:clean(r.mfxuid&&r.mfxuid!=='0xffffffff'?'MFX:'+r.mfxuid:'CS2:'+r.adresse,100),cv:{},metadata:{cs2Type:r.typ||'',mfxUid:r.mfxuid||'',symbol:r.symbol||'',vmax:r.vmax||'',vmin:r.vmin||'',raw:r}}));
  }
  function findVehicleArrays(value,depth=0){
    if(depth>5||!value||typeof value!=='object')return[];
    if(Array.isArray(value))return value.filter(x=>x&&typeof x==='object');
    const results=[];
    for(const [key,v] of Object.entries(value)){if(/^(locomotives|locos|vehicles|locoList|locoData|railwayVehicles)$/i.test(key)&&Array.isArray(v))results.push(...v);else if(v&&typeof v==='object')results.push(...findVehicleArrays(v,depth+1));}
    return results;
  }
  function parseZ21Json(text){
    let root;try{root=JSON.parse(String(text||''));}catch{return{ok:false,error:'El fitxer Z21 no és JSON de text. Cal seleccionar una exportació .z21 compatible o un fitxer JSON de biblioteca.'};}
    const rows=findVehicleArrays(root);if(!rows.length)return{ok:false,error:'No s’ha trobat cap llista de locomotores al fitxer exportat.'};
    const vehicles=rows.map((r,i)=>{
      const address=r.address??r.locoAddress??r.decoderAddress??r.dccAddress??'';
      const funcs=r.functions??r.funcs??r.functionKeys??r.Functions??[];
      const image=r.image??r.imageUrl??r.picture??r.icon??'';
      return{id:clean(r.id||r.uid||r.guid||('Z21-'+i),64),name:clean(r.name||r.title||r.description||('Locomotora '+(i+1))),kind:r.kind==='car'?'car':'locomotive',manufacturer:clean(r.manufacturer||r.brand||''),model:clean(r.model||r.type||''),article:clean(r.article||r.articleNumber||r.itemNumber||''),protocol:clean(r.protocol||r.format||'DCC').toUpperCase(),address:String(address),addressType:r.addressType||'auto',decoder:clean(r.decoder||r.decoderType||''),maxKmh:Number(r.maxKmh||r.maxSpeed)||null,image:String(image),drawing:String(r.drawing||r.symbol||''),functions:Array.isArray(funcs)?funcs.map((fn,j)=>typeof fn==='number'?{number:fn,label:'F'+fn,icon:'circle'}:{number:Number(fn.number??fn.functionNumber??fn.index??j),label:clean(fn.label||fn.name||fn.description||('F'+j)),icon:clean(fn.icon||fn.symbol||'circle'),momentary:!!fn.momentary,description:clean(fn.description||'')}):[],source:'ROCO_Z21_EXPORT',sourceId:clean(r.id||r.uid||r.guid||i,64),identity:address?'Z21:'+address:'Z21:'+clean(r.id||r.uid||i,64),cv:r.cv&&typeof r.cv==='object'?r.cv:{},metadata:{importedFields:Object.keys(r)}};});
    return{ok:true,vehicles,source:'ROCO_Z21_EXPORT'};
  }
  function parseJsonLibrary(text){let data;try{data=JSON.parse(String(text||''));}catch{return{ok:false,error:'El fitxer no és JSON vàlid.'};}const rows=Array.isArray(data)?data:(data.vehicles||data.locomotives||[]);if(!Array.isArray(rows)||!rows.length)return{ok:false,error:'El JSON no conté vehicles.'};return{ok:true,vehicles:rows.map((v,i)=>({...v,id:v.id||'JSON-'+i,source:v.source||'JSON_IMPORT'})),source:'JSON_IMPORT'};}
  function importText(filename,text){
    const ext=String(filename||'').toLowerCase().split('.').pop();
    if(ext==='cs2')return{ok:true,vehicles:parseCs2(text),source:'MARKLIN_CS2_FILE'};
    if(ext==='z21')return parseZ21Json(text);
    const cs2=String(text||'').includes('[lokomotive]');if(cs2)return{ok:true,vehicles:parseCs2(text),source:'MARKLIN_CS2_FILE'};
    return parseJsonLibrary(text);
  }
  function mergeImport(database,vehicles){
    const db=database&&typeof database==='object'?database:{vehicles:[]};db.vehicles=Array.isArray(db.vehicles)?db.vehicles:[];
    const result={added:0,updated:0,skipped:0,errors:[]};
    for(const item of vehicles||[]){const valid=windowlessValidate(item);if(!valid.ok){result.errors.push({name:item?.name||'',error:valid.error});continue;}
      const match=db.vehicles.find(v=>(valid.vehicle.identity&&v.identity===valid.vehicle.identity)||(v.source===valid.vehicle.source&&v.sourceId&&v.sourceId===valid.vehicle.sourceId));
      if(match){const merged={...match,...valid.vehicle,id:match.id,functions:valid.vehicle.functions.length?valid.vehicle.functions:match.functions,image:valid.vehicle.image||match.image,drawing:valid.vehicle.drawing||match.drawing,cv:Object.keys(valid.vehicle.cv||{}).length?valid.vehicle.cv:match.cv};Object.assign(match,merged);result.updated++;}
      else{db.vehicles.push({...valid.vehicle,id:valid.vehicle.id||'RS-IMPORT-'+Date.now().toString(36)+'-'+result.added});result.added++;}
    }
    return result;
  }
  function windowlessValidate(input){
    const name=clean(input?.name,100);if(!name)return{ok:false,error:'Vehicle sense nom.'};
    const allowed=['DCC','MFX','M4','MM2','MOTOROLA','RAILCOM','RAILCOMPLUS','OTHER'];let protocol=clean(input.protocol||'DCC',24).toUpperCase();if(!allowed.includes(protocol))protocol='OTHER';
    const rawImage=String(input.image||''),image=/^(https?:\\/\\/|data:image\\/(?:png|jpeg|jpg|webp|gif);base64,)/i.test(rawImage)?rawImage:'';const safeFunctions=(Array.isArray(input.functions)?input.functions:[]).slice(0,69).map((fn,index)=>{const icon=String(fn?.icon||'circle');return{...fn,number:Number(fn?.number??index),label:clean(fn?.label||('F'+index),80),icon:(icon.startsWith('data:image/')||/^https?:/i.test(icon))?icon:clean(icon,80)};});return{ok:true,vehicle:{...input,name,protocol,image,functions:safeFunctions,cv:input.cv&&typeof input.cv==='object'?input.cv:{},source:clean(input.source||'IMPORT',64),sourceId:clean(input.sourceId||'',80),identity:clean(input.identity||'',120)}};
  }
  const api={parseCs2,parseZ21Json,parseJsonLibrary,importText,mergeImport};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.JMRI_TC_RollingStockImport=api;
})(typeof window!=='undefined'?window:globalThis);
