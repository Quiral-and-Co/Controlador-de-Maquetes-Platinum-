'use strict';
(function(root){
  const DEFAULT_MAX_AGE_MS=15000;
  function isFresh(timestamp,now,maxAge=DEFAULT_MAX_AGE_MS){
    return Number.isFinite(Number(timestamp))&&Number(timestamp)<=now+1000&&now-Number(timestamp)<=maxAge;
  }
  function inspect(config={},telemetry={},snapshot={},now=Date.now(),maxAge=DEFAULT_MAX_AGE_MS){
    const levels=Array.isArray(config.levels)?config.levels:[];
    const sensors=levels.flatMap(level=>Array.isArray(level.sensors)?level.sensors:[]);
    const blocks=levels.flatMap(level=>(level.blocks||[]).map(block=>({...block,levelName:level.name||String(level.id)})));
    const tracks=levels.flatMap(level=>level.tracks||[]);
    const incidents=[],validSensors=[];
    const connected=telemetry.connected===true&&isFresh(telemetry.lastHeartbeatAt,now,maxAge);
    if(!connected)incidents.push({severity:'error',code:'JMRI_DISCONNECTED',message:'Comunicació JMRI absent o heartbeat obsolet; les lectures es consideren desconegudes.'});
    for(const sensor of sensors){
      if(!sensor.systemName){incidents.push({severity:'warning',code:'SENSOR_NO_SYSTEM_NAME',message:'Sensor '+(sensor.name||sensor.id||'sense identificador')+' sense systemName JMRI.'});continue;}
      if(sensor.verified!==true){incidents.push({severity:'warning',code:'SENSOR_UNVERIFIED',message:'Sensor '+sensor.systemName+' no verificat; no pot validar ocupació.'});continue;}
      const updated=telemetry.sensorUpdatedAt?.[sensor.systemName];
      const raw=telemetry.sensors?.[sensor.systemName];
      if(!connected||!isFresh(updated,now,maxAge)||raw===undefined){
        incidents.push({severity:'error',code:'SENSOR_STALE',message:'Sensor '+sensor.systemName+' sense lectura actualitzada; estat desconegut.'});continue;
      }
      const value=Number(raw);
      if(value!==2&&value!==4){incidents.push({severity:'error',code:'SENSOR_INVALID',message:'Sensor '+sensor.systemName+' ha retornat un estat invàlid.'});continue;}
      validSensors.push(sensor.systemName);
    }
    for(const track of tracks){
      if(!track.turnoutSystemName)continue;
      const name=track.turnoutSystemName,updated=telemetry.turnoutUpdatedAt?.[name],raw=telemetry.turnouts?.[name];
      if(!connected||!isFresh(updated,now,maxAge)||raw===undefined||![2,4].includes(Number(raw))){
        incidents.push({severity:'error',code:'TURNOUT_UNKNOWN',message:'Desviament '+name+' sense estat JMRI vàlid i actualitzat.'});
      }
    }
    let unknownBlocks=0;
    for(const block of blocks){
      if(block.verified!==true||!Array.isArray(block.sensorIds)||!block.sensorIds.length){unknownBlocks++;continue;}
      const mapped=block.sensorIds.map(id=>sensors.find(sensor=>sensor.id===id));
      if(mapped.some(sensor=>!sensor||sensor.verified!==true||!sensor.systemName||!validSensors.includes(sensor.systemName))){unknownBlocks++;}
    }
    for(const route of snapshot.routes||[]){
      const statuses=(route.blockIds||[]).map(id=>snapshot.blockStates?.[id]||'UNKNOWN');
      if(statuses.some(status=>status!=='FREE'))incidents.push({severity:'warning',code:'ROUTE_NOT_CLEAR',message:'Itinerari '+route.name+' bloquejat: un o més blocs no estan confirmats lliures.'});
    }
    return{connected,validSensorCount:validSensors.length,incidentCount:incidents.length,unknownBlocks,incidents};
  }
  const api={DEFAULT_MAX_AGE_MS,isFresh,inspect};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.JMRI_TC_JmriDiagnosticsCore=api;
})(typeof window!=='undefined'?window:globalThis);
