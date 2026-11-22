(function(){
'use strict';
const $=id=>document.getElementById(id),core=window.JMRI_TC_TrainGround;
let state;
function apply(result){if(result&&result.ok){state=result.state;render();}else if(result)status(result.error);}
function status(v){$('tgStatus').textContent=v;}
function render15SegmentDisplay(value){
 const host=$('tg15SegmentDisplay');if(!host)return;
 const map={'0':[0,1,2,5,6,7],'1':[2,6],'2':[0,2,3,4,5,7],'3':[0,2,3,4,6,7],'4':[1,2,3,4,6],'5':[0,1,3,4,6,7],'6':[0,1,3,4,5,6,7],'7':[0,2,6],'8':[0,1,2,3,4,5,6,7],'9':[0,1,2,3,4,6,7]};
 const lines=[[5,5,35,5],[5,8,5,28],[35,8,35,28],[5,32,19,32],[21,32,35,32],[5,36,5,56],[35,36,35,56],[5,59,35,59],[20,7,20,29],[20,35,20,57],[7,8,19,29],[33,8,21,29],[7,56,19,35],[33,56,21,35],[20,29,20,35]];
 const ns='http://www.w3.org/2000/svg',digits=String(value||'000000').slice(-8);
 host.replaceChildren();
 for(const char of digits){
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 40 64');svg.setAttribute('width','40');svg.setAttribute('height','64');svg.setAttribute('aria-hidden','true');
  const active=new Set(map[char]||[]);
  lines.forEach((coords,index)=>{const line=document.createElementNS(ns,'line');['x1','y1','x2','y2'].forEach((key,i)=>line.setAttribute(key,String(coords[i])));line.setAttribute('class',active.has(index)?'segment-on':'segment-off');svg.append(line);});
  host.append(svg);
 }
 host.setAttribute('aria-label','Dígits '+digits+' en pantalla de quinze segments');
}
function render(){if(!state)return;
$('tgNetwork').textContent=state.network;$('tgCallState').textContent=({IDLE:'EN ESPERA',CALLING:'TRUCANT…',RINGING:'TRUCADA ENTRANT',CONNECTED:'COMUNICACIÓ OBERTA'})[state.callState];
$('tgRegistration').textContent=state.mode==='GSMR'?(state.registered?'REGISTRAT':'NO REGISTRAT'):'ANALÒGIC';
$('tgRegistration').className='tg-pill '+(state.mode==='GSMR'&&state.registered?'ready':'');
$('tgMode').value=state.mode;$('tgChannel').value=state.channel;$('tgTrainId').value=state.trainId;$('tgRadioId').value=state.radioId;$('tgPeer').value=state.peer;$('tgFunction').value=state.selectedFunction;
$('tgRegister').disabled=state.mode!=='GSMR'||state.registered;$('tgCall').disabled=state.callState!=='IDLE'||(state.mode==='GSMR'&&!state.registered);$('tgAnswer').disabled=!['CALLING','RINGING'].includes(state.callState);$('tgRelease').disabled=state.callState==='IDLE';$('tgTransmit').disabled=state.callState!=='CONNECTED';$('tgPttOn').disabled=state.callState!=='CONNECTED';$('tgPttOff').disabled=!state.ptt;
$('tgPttState').textContent=state.ptt?'PTT · PREMUTAT':'PTT · EN REPÒS';
 const value=(state.dialled||state.trainId||'').replace(/[^0-9]/g,'').slice(-8).padStart(6,'0');render15SegmentDisplay(value);
 $('tg15SegmentMode').textContent=(state.mode==='GSMR'?'GSM-R':'ANALÒGIC')+' · '+({IDLE:'EN ESPERA',CALLING:'TRUCANT',RINGING:'ENTRANT',CONNECTED:'CONNECTAT'})[state.callState];
$('tgMessages').replaceChildren();state.messages.slice().reverse().forEach(m=>{const li=document.createElement('li');li.textContent=m.mode+' · '+m.from+' → '+m.to+': '+m.text;$('tgMessages').append(li);});
$('tgEvents').replaceChildren();state.events.slice().reverse().forEach(e=>{const li=document.createElement('li');li.textContent=e.type+' · '+e.message;$('tgEvents').append(li);});
}
function init(){if(!$('trainGroundPanel'))return;state=core.createState();
$('tgMode').onchange=()=>apply(core.setMode(state,$('tgMode').value));
$('tgRegister').onclick=()=>apply(core.register(state));
$('tgSave').onclick=()=>apply(core.configure(state,{channel:$('tgChannel').value,trainId:$('tgTrainId').value,radioId:$('tgRadioId').value,peer:$('tgPeer').value,selectedFunction:$('tgFunction').value}));
$('tgCall').onclick=()=>{const c=core.configure(state,{peer:$('tgPeer').value,selectedFunction:$('tgFunction').value});if(c.ok)state=c.state;apply(core.call(state,$('tgPeer').value));};
$('tgAnswer').onclick=()=>apply(core.answer(state));
$('tgIncoming').onclick=()=>apply(core.incoming(state,$('tgPeer').value||'Regulació'));
$('tgRelease').onclick=()=>apply(core.release(state));
$('tgTransmit').onclick=()=>apply(core.transmit(state,$('tgText').value));
$('tgPttOn').onclick=()=>apply(core.press(state,'PTT_ON'));$('tgPttOff').onclick=()=>apply(core.press(state,'PTT_OFF'));
$('tgEmergency').onclick=()=>apply(core.press(state,'EMERGENCY'));$('tgClear').onclick=()=>apply(core.press(state,'CLEAR'));
$('tgDialKeys').addEventListener('click',e=>{const b=e.target.closest('button[data-digit]');if(!b)return;$('tgPeer').value+=$('tgPeer').value.length<40?b.dataset.digit:'';});
$('tgMessagesClear').onclick=()=>{state.messages=[];render();};
render();status('Terminal preparat en mode local de simulació.');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
