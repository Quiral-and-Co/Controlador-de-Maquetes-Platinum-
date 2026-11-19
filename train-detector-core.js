'use strict';
(function(root){
  const MAX_AGE_MS=15000;
  function sensorState(raw,invert=false){
    let value=raw&&typeof raw==='object'?raw.state:raw;
    const n=Number(value),s=String(value??'').trim().toUpperCase();
    let state=(n===2||['ACTIVE','OCCUPIED','ON','TRUE'].includes(s))?'OCCUPIED':
      (n===4||['INACTIVE','FREE','CLEAR','OFF','FALSE'].includes(s))?'FREE':'UNKNOWN';
    if(invert&&state!=='UNKNOWN')state=state==='FREE'?'OCCUPIED':'FREE';
    return state;
  }
  function fresh(timestamp,now,maxAge=MAX_AGE_MS){
    const t=Number(timestamp);
    return Number.isFinite(t)&&t<=now+1000&&now-t<=maxAge;
  }
  function evaluateBlock(block,sensors,telemetry,now=Date.now(),maxAge=MAX_AGE_MS){
    if(!block||block.verified!==true||!Array.isArray(block.sensorIds)||!block.sensorIds.length)return{state:'UNKNOWN',reason:'Bloc no verificat o sense detectors assignats.'};
    if(telemetry?.connected!==true)return{state:'UNKNOWN',reason:'Sense connexió amb el sistema de control.'};
    const defs=block.sensorIds.map(id=>sensors.find(s=>s.id===id));
    if(defs.some(s=>!s||s.verified!==true||!s.systemName))return{state:'UNKNOWN',reason:'Hi ha detectors no configurats o no verificats.'};
    const readings=defs.map(s=>{
      const raw=telemetry.sensors?.[s.systemName];
      const timestamp=telemetry.sensorUpdatedAt?.[s.systemName];
      if(raw===undefined||!fresh(timestamp,now,maxAge))return'UNKNOWN';
      return sensorState(raw,s.invert===true);
    });
    if(readings.some(s=>s==='UNKNOWN'))return{state:'UNKNOWN',reason:'Lectura absent, invàlida o caducada.'};
    if(readings.includes('OCCUPIED'))return{state:'OCCUPIED',reason:'Com a mínim un detector assignat indica ocupació.'};
    return{state:'FREE',reason:'Tots els detectors assignats indiquen via lliure.'};
  }
  function inspect(config,telemetry,now=Date.now(),maxAge=MAX_AGE_MS){
    const rows=[];
    for(const level of config?.levels||[]){
      const sensors=level.sensors||[];
      for(const block of level.blocks||[]){
        const result=evaluateBlock(block,sensors,telemetry,now,maxAge);
        const sensorReadings=(block.sensorIds||[]).map(id=>{const sensor=sensors.find(s=>s.id===id);const current=sensor&&telemetry?.connected===true&&fresh(telemetry.sensorUpdatedAt?.[sensor.systemName],now,maxAge)&&telemetry.sensors?.[sensor.systemName]!==undefined?sensorState(telemetry.sensors[sensor.systemName],sensor.invert===true):'UNKNOWN';return{id,sensorName:sensor?.systemName||id,userName:sensor?.userName||'',state:current,verified:sensor?.verified===true};});
        rows.push({levelId:level.id,levelName:level.name||('Nivell '+level.id),blockId:block.id,name:block.name||block.id,...result,sensorCount:block.sensorIds?.length||0,sensorReadings});
      }
    }
    return rows;
  }
  const api={MAX_AGE_MS,sensorState,fresh,evaluateBlock,inspect};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.JMRI_TC_TRAIN_DETECTOR_CORE=api;
})(typeof window!=='undefined'?window:globalThis);
