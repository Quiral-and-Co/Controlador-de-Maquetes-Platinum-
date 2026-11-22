'use strict';
(function(root){
  const PROTOCOLS=Object.freeze({
    S88:{label:'S88',family:'S88',transport:'JMRI',description:'Retromòduls S88 clàssics.'},
    S88N:{label:'S88-N',family:'S88',transport:'JMRI',description:'S88 amb connexió de xarxa/cablejat S88-N.'},
    RS:{label:'RS (Lenz)',family:'RS',transport:'JMRI',description:'Bus de retroinformació RS de Lenz.'},
    LOCONET:{label:'LocoNet',family:'LOCONET',transport:'JMRI',description:'Sensors de retroinformació LocoNet.'},
    RBUS:{label:'R-bus (Roco/z21)',family:'RBUS',transport:'JMRI',description:'Entrades de retroinformació R-bus.'},
    XPRESSNET:{label:'XpressNet / feedback',family:'XPRESSNET',transport:'JMRI',description:'Sistema de retroinformació exposat pel servidor JMRI.'},
    JMRI:{label:'JMRI genèric',family:'GENERIC',transport:'JMRI',description:'Qualsevol sistema de sensors publicat per JMRI.'},
    CUSTOM:{label:'Altres / personalitzat',family:'CUSTOM',transport:'JMRI',description:'Protocol addicional exposat mitjançant JMRI.'}
  });
  function canonical(value){const key=String(value||'JMRI').trim().toUpperCase().replace(/[ -]/g,'');return key==='S88N'?'S88N':key==='S88'?'S88':key==='RS'?'RS':key==='LOCONET'?'LOCONET':key==='RBUS'?'RBUS':key==='XPRESSNET'?'XPRESSNET':key==='CUSTOM'?'CUSTOM':'JMRI';}
  function validate(sensor){
    const errors=[];
    if(!sensor||typeof sensor!=='object')return{valid:false,errors:['Configuració absent.']};
    if(!/^[A-Za-z0-9_.:-]{1,80}$/.test(String(sensor.systemName||'')))errors.push('System name invàlid.');
    if(!String(sensor.moduleAddress??'').trim())errors.push('Cal indicar l’adreça del retromòdul.');
    const input=Number(sensor.input);
    if(!Number.isInteger(input)||input<1||input>4096)errors.push('L’entrada ha de ser un enter entre 1 i 4096.');
    const debounce=Number(sensor.debounceMs??0),timeout=Number(sensor.timeoutMs??15000);
    if(!Number.isInteger(debounce)||debounce<0||debounce>5000)errors.push('El filtre antirebots ha d’estar entre 0 i 5000 ms.');
    if(!Number.isInteger(timeout)||timeout<1000||timeout>120000)errors.push('El temps màxim de lectura ha d’estar entre 1000 i 120000 ms.');
    return{valid:errors.length===0,errors};
  }
  function describe(sensor){const key=canonical(sensor?.protocol);return{protocol:key,label:PROTOCOLS[key].label,family:PROTOCOLS[key].family,transport:PROTOCOLS[key].transport};}
  const api={PROTOCOLS,canonical,validate,describe};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.JMRI_TC_TRAIN_DETECTOR_PROTOCOLS=api;
})(typeof window!=='undefined'?window:globalThis);
