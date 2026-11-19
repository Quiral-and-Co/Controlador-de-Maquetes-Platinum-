(() => {
'use strict';
const core=window.JMRI_TC_AUTOTRAIN_CORE;if(!core)return;
const $=id=>document.getElementById(id);
let enabled=false,sourceId=null;
function snapshot(){return window.JMRI_TC_DISPATCHER_UI?.getSnapshot?.()||{blocks:[],blockStates:{},reservations:{},routes:[]};}
function setEnabled(value){enabled=value===true;document.body.classList.toggle('autotrain-drag-active',enabled);document.querySelectorAll('[data-autotrain-toggle]').forEach(b=>{b.setAttribute('aria-pressed',String(enabled));b.classList.toggle('active',enabled);});if(!enabled)sourceId=null;decorateBlocks();const message=$('dispatcherMessage');if(message)message.textContent=enabled?'AutoTrain actiu: arrossega un bloc ocupat fins al bloc de destinació.':'AutoTrain desactivat.';}
function decorateBlocks(){
 const host=$('dispatcherBlocks');if(!host)return;
 const blocks=snapshot().blocks||[];
 [...host.children].forEach((row,index)=>{
  const block=blocks[index];if(!block)return;
  row.dataset.blockId=String(block.id);
  row.draggable=enabled;row.classList.toggle('autotrain-draggable',enabled);
  if(row.dataset.autotrainBound==='1')return;
  row.dataset.autotrainBound='1';
  row.addEventListener('dragstart',event=>{
   if(!enabled||window.JMRI_TC_BOARD?.getTrainEditMode?.()===true){event.preventDefault();return;}
   sourceId=row.dataset.blockId;event.dataTransfer?.setData('text/plain',sourceId);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';row.classList.add('autotrain-source');
  });
  row.addEventListener('dragend',()=>{sourceId=null;row.classList.remove('autotrain-source');host.querySelectorAll('.autotrain-target').forEach(x=>x.classList.remove('autotrain-target'));});
  row.addEventListener('dragover',event=>{if(!enabled||!sourceId||sourceId===row.dataset.blockId)return;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';row.classList.add('autotrain-target');});
  row.addEventListener('dragleave',()=>row.classList.remove('autotrain-target'));
  row.addEventListener('drop',event=>{if(!enabled)return;event.preventDefault();row.classList.remove('autotrain-target');const from=event.dataTransfer?.getData('text/plain')||sourceId,to=row.dataset.blockId;sourceId=null;prepare(from,to);});
 });
}
function ensureDialog(){
 let dialog=$('autoTrainDialog');if(dialog)return dialog;
 dialog=document.createElement('dialog');dialog.id='autoTrainDialog';dialog.className='autotrain-dialog';
 dialog.innerHTML='<form method="dialog" class="autotrain-card"><h2>AutoTrain by Drag & Drop</h2><p id="autoTrainPath" class="autotrain-path"></p><label>Locomotora<select id="autoTrainLoco" required></select></label><p id="autoTrainStatus" role="status" aria-live="polite"></p><div class="autotrain-actions"><button value="cancel">Cancel·lar</button><button id="autoTrainConfirm" type="button" class="primary">Confirmar i iniciar</button></div></form>';
 document.body.append(dialog);
 const style=document.createElement('style');style.textContent='.autotrain-dialog{border:0;border-radius:12px;padding:0;max-width:min(520px,92vw);width:100%;box-shadow:0 18px 60px #0005}.autotrain-dialog::backdrop{background:#10182799}.autotrain-card{padding:22px;display:grid;gap:14px}.autotrain-card h2{margin:0}.autotrain-card label{display:grid;gap:6px}.autotrain-card select{padding:9px}.autotrain-path{font-weight:600;overflow-wrap:anywhere}.autotrain-actions{display:flex;justify-content:flex-end;gap:8px}.autotrain-draggable{cursor:grab}.autotrain-drag-active .autotrain-draggable{outline:1px dashed #159447;outline-offset:2px}.autotrain-source{opacity:.55}.autotrain-target{outline:2px solid #159447!important;background:#e5f6ea!important}.autotrain-drag-active{cursor:grabbing}';
 document.head.append(style);
 dialog.querySelector('#autoTrainConfirm').addEventListener('click',()=>{
  const locoId=$('autoTrainLoco').value,plan=dialog._plan;if(!plan||!locoId)return;
  const button=$('autoTrainConfirm');button.disabled=true;
  const result=window.JMRI_TC_TRAFFIC_CONTROL?.planAndStartAutoTrain?.({locomotiveId:locoId,blockIds:plan.blockIds,turnoutRequirements:plan.turnoutRequirements,maxSpeed:12});
  $('autoTrainStatus').textContent=result?.ok?'Adquisició sol·licitada. El moviment només començarà després de confirmar-la.':(result?.error||'AutoTrain no està disponible.');
  if(result?.ok){setEnabled(false);window.JMRI_TC_TRAFFIC_UI?.refresh?.();window.JMRI_TC_DISPATCHER_UI?.refresh?.();window.setTimeout(()=>{if(dialog.open)dialog.close();button.disabled=false;},900);}else button.disabled=false;
 });
 return dialog;
}
function prepare(from,to){
 if(window.JMRI_TC_BOARD?.getTrainEditMode?.()===true){setEnabled(false);return;}
 const snap=snapshot(),found=core.shortestPath(snap.routes,from,to);if(!found.ok){alert(found.error);return;}
 const traffic=window.JMRI_TC_TRAFFIC_CONTROL?.getSnapshot?.(),locos=traffic?.locomotives||[];
 if(!locos.length){alert('No hi ha cap locomotora registrada al mòdul de circulacions.');return;}
 const validation=core.validatePlan({blockIds:found.blockIds,snapshot:snap,locomotiveId:locos[0].id,editMode:false});
 if(!validation.ok){alert('AutoTrain rebutjat: '+validation.error);return;}
 const dialog=ensureDialog(),select=$('autoTrainLoco');select.replaceChildren();
 locos.forEach(l=>{const option=document.createElement('option');option.value=l.id;option.textContent=l.name+' · '+l.wiThrottleId;select.append(option);});
 $('autoTrainPath').textContent=found.blockIds.join(' → ');
 $('autoTrainStatus').textContent='Ruta calculada. Es tornaran a comprovar sensors, reserves, alimentació, desviaments i interbloqueigs DCC abans d’enviar cap ordre.';
 dialog._plan=found;dialog.showModal();
}
function initialize(){
 document.querySelectorAll('[data-autotrain-toggle]').forEach(b=>b.addEventListener('click',()=>setEnabled(!enabled)));
 const host=$('dispatcherBlocks');if(host){new MutationObserver(()=>decorateBlocks()).observe(host,{childList:true});decorateBlocks();}
 window.JMRI_TC_AUTOTRAIN_UI={setEnabled,isEnabled:()=>enabled,refresh:decorateBlocks};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})();
