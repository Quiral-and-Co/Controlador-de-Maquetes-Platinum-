(() => {
'use strict';
const core=window.JMRI_TC_AUTOTRAIN_CORE;if(!core)return;
const $=id=>document.getElementById(id);
let enabled=false,sourceId=null;
function snapshot(){return window.JMRI_TC_DISPATCHER_UI?.getSnapshot?.()||{blocks:[],blockStates:{},reservations:{},routes:[]};}
function setEnabled(value){
 enabled=value===true;document.body.classList.toggle('autotrain-drag-active',enabled);
 document.querySelectorAll('[data-autotrain-toggle]').forEach(b=>{b.setAttribute('aria-pressed',String(enabled));b.classList.toggle('active',enabled);});
 if(!enabled)sourceId=null;decorateBlocks();decorateSwitchboard();
 const message=$('dispatcherMessage');if(message)message.textContent=enabled?'AutoTrain actiu: arrossega un bloc ocupat fins al bloc de destinació.':'AutoTrain desactivat.';
}
function bindDragTarget(node,getBlockId){
 node.draggable=enabled;node.classList.toggle('autotrain-draggable',enabled);
 if(node.dataset.autotrainBound==='1')return;node.dataset.autotrainBound='1';
 node.addEventListener('dragstart',event=>{
  if(!enabled||window.JMRI_TC_BOARD?.getTrainEditMode?.()===true){event.preventDefault();return;}
  sourceId=getBlockId();if(!sourceId){event.preventDefault();return;}
  event.dataTransfer?.setData('text/plain',sourceId);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
  node.classList.add('autotrain-source');
 });
 node.addEventListener('dragend',()=>{sourceId=null;node.classList.remove('autotrain-source');document.querySelectorAll('.autotrain-target').forEach(x=>x.classList.remove('autotrain-target'));});
 node.addEventListener('dragover',event=>{const id=getBlockId();if(!enabled||!sourceId||sourceId===id)return;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';node.classList.add('autotrain-target');});
 node.addEventListener('dragleave',()=>node.classList.remove('autotrain-target'));
 node.addEventListener('drop',event=>{if(!enabled)return;event.preventDefault();node.classList.remove('autotrain-target');const from=event.dataTransfer?.getData('text/plain')||sourceId,to=getBlockId();sourceId=null;if(from&&to)prepare(from,to);});
}
function decorateBlocks(){
 const host=$('dispatcherBlocks');if(!host)return;const blocks=snapshot().blocks||[];
 [...host.children].forEach((row,index)=>{const block=blocks[index];if(!block)return;row.dataset.blockId=String(block.id);bindDragTarget(row,()=>row.dataset.blockId);});
}
function decorateSwitchboard(){
 const host=$('trackSvg');if(!host)return;
 host.querySelectorAll('.track-piece[data-block-id]').forEach(piece=>{if(!piece.dataset.blockId)return;bindDragTarget(piece,()=>piece.dataset.blockId);});
}
function ensureDialog(){
 let dialog=$('autoTrainDialog');if(dialog)return dialog;
 dialog=document.createElement('dialog');dialog.id='autoTrainDialog';dialog.className='autotrain-dialog';
 dialog.innerHTML='<form method="dialog" class="autotrain-card"><h2>AutoTrain by Drag & Drop</h2><p id="autoTrainPath" class="autotrain-path"></p><label>Locomotora<select id="autoTrainLoco" required></select></label><label class="autotrain-source-confirm"><input id="autoTrainSourceConfirm" type="checkbox"> Confirmo que aquesta locomotora és físicament al bloc d’origen.</label><p id="autoTrainStatus" role="status" aria-live="polite">La preparació no mou cap tren ni envia ordres físiques.</p><div class="autotrain-actions"><button value="cancel">Cancel·lar</button><button id="autoTrainConfirm" type="button" class="primary">Validar i preparar ruta</button></div></form>';
 document.body.append(dialog);
 const style=document.createElement('style');style.textContent='.autotrain-dialog{border:0;border-radius:12px;padding:0;max-width:min(520px,92vw);width:100%;box-shadow:0 18px 60px #0005}.autotrain-dialog::backdrop{background:#10182799}.autotrain-card{padding:22px;display:grid;gap:14px}.autotrain-card h2{margin:0}.autotrain-card label{display:grid;gap:6px}.autotrain-card select{padding:9px}.autotrain-path{font-weight:600;overflow-wrap:anywhere}.autotrain-actions{display:flex;justify-content:flex-end;gap:8px}.autotrain-draggable{cursor:grab}.autotrain-drag-active .autotrain-draggable{outline:1px dashed #159447;outline-offset:2px}.autotrain-source{opacity:.55}.autotrain-target{outline:2px solid #159447!important;background:#e5f6ea!important}.autotrain-drag-active{cursor:grabbing}';
 document.head.append(style);
 dialog.querySelector('#autoTrainConfirm').addEventListener('click',()=>{
  const locoId=$('autoTrainLoco').value,plan=dialog._plan;if(!plan||!locoId)return;
  const button=$('autoTrainConfirm');button.disabled=true;
  const result=window.JMRI_TC_TRAFFIC_CONTROL?.prepareAutoTrain?.({locomotiveId:locoId,blockIds:plan.blockIds,turnoutRequirements:plan.turnoutRequirements,sourceConfirmed:$('autoTrainSourceConfirm').checked===true});
  $('autoTrainStatus').textContent=result?.ok?'Ruta validada i preparada. No s’ha mogut cap tren: l’execució física continua bloquejada fins a completar la integració d’enclavaments, senyals i validació supervisada.':(result?.error||'AutoTrain no està disponible.');
  if(result?.ok){setEnabled(false);window.setTimeout(()=>{if(dialog.open)dialog.close();button.disabled=false;},1400);}else button.disabled=false;
 });
 return dialog;
}
function prepare(from,to){
 if(window.JMRI_TC_BOARD?.getTrainEditMode?.()===true){setEnabled(false);return;}
 const snap=snapshot(),found=core.shortestPath(snap.routes,from,to);if(!found.ok){alert(found.error);return;}
 const locos=window.JMRI_TC_TRAFFIC_CONTROL?.getSnapshot?.()?.locomotives||[];
 const profiles=window.JMRI_TC_DISPATCHER?.getConfig?.()?.trainRoster?.speedProfiles||{};
 const eligible=locos.filter(l=>profiles[l.id]?.verified===true);
 if(!eligible.length){alert('No hi ha cap locomotora amb un perfil de velocitat calibrat i verificat. AutoTrain queda bloquejat.');return;}
 const validation=core.validatePlan({blockIds:found.blockIds,snapshot:snap,locomotiveId:eligible[0].id,speedProfileVerified:true,sourceConfirmed:true,editMode:false});
 if(!validation.ok){alert('AutoTrain rebutjat: '+validation.error);return;}
 const dialog=ensureDialog(),select=$('autoTrainLoco');select.replaceChildren();
 eligible.forEach(l=>{const option=document.createElement('option');option.value=l.id;option.textContent=l.name+' · '+l.wiThrottleId;select.append(option);});
 $('autoTrainPath').textContent=found.blockIds.join(' → ');$('autoTrainSourceConfirm').checked=false;
 $('autoTrainStatus').textContent='Ruta calculada. Cal confirmar la ubicació física de la locomotora. Encara no s’enviarà cap ordre de moviment.';
 dialog._plan=found;dialog.showModal();
}
function initialize(){
 document.querySelectorAll('[data-autotrain-toggle]').forEach(b=>b.addEventListener('click',()=>setEnabled(!enabled)));
 const host=$('dispatcherBlocks');if(host)new MutationObserver(()=>{decorateBlocks();decorateSwitchboard();}).observe(host,{childList:true});
 const svg=$('trackSvg');if(svg)new MutationObserver(decorateSwitchboard).observe(svg,{childList:true,subtree:true});
 decorateBlocks();decorateSwitchboard();
 window.JMRI_TC_AUTOTRAIN_UI={setEnabled,isEnabled:()=>enabled,refresh:()=>{decorateBlocks();decorateSwitchboard();}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})();
