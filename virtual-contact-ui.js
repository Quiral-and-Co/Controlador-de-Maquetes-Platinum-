(() => {
'use strict';
const core=window.JMRI_TC_VIRTUAL_CONTACT_CORE;if(!core)return;
const $=id=>document.getElementById(id);
const positionEstimates=new Map(),lastStates=new Map();
function config(){return window.JMRI_TC_DISPATCHER?.getConfig?.();}
function selectedLevel(){const c=config(),id=window.JMRI_TC_BOARD?.getSelectedLevel?.();return(c?.levels||[]).find(l=>String(l.id)===String(id));}
function blocks(){return selectedLevel()?.blocks||[];}
function sensors(){return(config()?.levels||[]).flatMap(l=>l.sensors||[]);}
function sensorStates(){const raw=window.JMRI_TC_DISPATCHER?.getSensorStates?.()||{},out={};for(const [name,value] of Object.entries(raw)){const s=window.JMRI_TC_DispatcherCore?.normalizeSensorState?.(value,false);out[name]=s==='OCCUPIED'?'ACTIVE':s==='FREE'?'INACTIVE':'UNKNOWN';}return out;}
function announce(message){const node=$('virtualContactMessage');if(node)node.textContent=message;window.JMRI_TC_DISPATCHER?.log?.('[Contactes virtuals] '+message);}
function render(){
 const host=$('virtualContactList');if(!host)return;host.replaceChildren();
 const level=selectedLevel();if(!level){host.textContent='Selecciona un nivell per configurar contactes virtuals.';return;}
 const items=level.virtualContacts||[];
 if(!items.length){host.textContent='Aquest nivell encara no té contactes virtuals.';return;}
 const context={sensorStates:sensorStates(),positionEstimates:Object.fromEntries(positionEstimates)};
 for(const item of items){
  const result=core.evaluate(item,{...context,positionEstimate:context.positionEstimates[item.blockId]});
  const row=document.createElement('div');row.className='virtual-contact-row';
  const main=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small'),status=document.createElement('span');
  name.textContent=item.name;meta.textContent='Bloc '+item.blockId+' · '+({DISTANCE:'Distància',TIME:'Temps',LOGIC:'Lògica'}[item.trigger?.type]||'Disparador')+' · sense adreça digital';
  status.className='virtual-contact-state '+result.state.toLowerCase();const previous=lastStates.get(item.id);if(result.state==='ACTIVE'&&previous!=='ACTIVE'){window.dispatchEvent(new CustomEvent('virtualcontacttrigger',{detail:{id:item.id,blockId:item.blockId,name:item.name,action:item.action,kind:'VIRTUAL'}}));}lastStates.set(item.id,result.state);status.textContent=({ACTIVE:'Actiu',INACTIVE:'Inactiu',UNKNOWN:'Sense dades'}[result.state]||result.state)+' — '+result.reason;
  main.append(name,meta,status);const remove=document.createElement('button');remove.type='button';remove.textContent='Eliminar';remove.addEventListener('click',()=>{window.JMRI_TC_DISPATCHER?.checkpoint?.();level.virtualContacts=items.filter(x=>x.id!==item.id);announce('Contacte virtual eliminat.');render();});
  row.append(main,remove);host.append(row);
 }
}
function create(){
 const level=selectedLevel();if(!level){announce('Selecciona un nivell.');return;}
 const blockId=$('virtualContactBlock').value,block=(level.blocks||[]).find(b=>String(b.id)===blockId),type=$('virtualContactType').value;
 const conditions=$('virtualContactConditions').value.split(',').map(x=>{const m=x.trim().match(/^([A-Za-z0-9_.:-]{1,80})\s*=\s*(ACTIVE|INACTIVE)$/i);return m?{systemName:m[1],state:m[2].toUpperCase()}:null;});
 const id='VC-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
 const trigger=type==='DISTANCE'?{type,distanceMm:Number($('virtualContactDistance').value)}:type==='TIME'?{type,seconds:Number($('virtualContactTime').value)}:{type,operator:$('virtualContactOperator').value,conditions};
 const result=core.normalizeDefinition({id,blockId,name:$('virtualContactName').value,trigger,action:$('virtualContactAction').value},blocks(),sensors());
 if(!result.ok){announce(result.error);return;}
 window.JMRI_TC_DISPATCHER?.checkpoint?.();level.virtualContacts=Array.isArray(level.virtualContacts)?level.virtualContacts:[];level.virtualContacts.push(result.contact);
 $('virtualContactName').value='';announce('Contacte virtual creat. No té adreça digital i no altera l’ocupació ni els enclavaments del bloc.');window.JMRI_TC_DISPATCHER?.refresh?.();render();
}
function updateFields(){const type=$('virtualContactType')?.value;if($('virtualContactDistanceField'))$('virtualContactDistanceField').hidden=type!=='DISTANCE';if($('virtualContactTimeField'))$('virtualContactTimeField').hidden=type!=='TIME';if($('virtualContactLogicField'))$('virtualContactLogicField').hidden=type!=='LOGIC';}
function decorateSwitchboard(){
 const svg=document.getElementById('trackSvg');if(!svg)return;
 const c=config(),contacts=(c?.levels||[]).flatMap(l=>l.virtualContacts||[]);
 const byBlock=new Map();for(const item of contacts){if(!byBlock.has(String(item.blockId)))byBlock.set(String(item.blockId),[]);byBlock.get(String(item.blockId)).push(item);}
 svg.querySelectorAll('.track-piece[data-block-id]').forEach(piece=>{
  const items=byBlock.get(String(piece.dataset.blockId))||[];
  const existing=piece.querySelector('[data-virtual-contact-marker]');
  if(!items.length){existing?.remove();return;}if(existing)return;
  const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');g.setAttribute('data-virtual-contact-marker','true');g.setAttribute('class','virtual-contact-marker');g.setAttribute('transform','translate(12 -25)');g.setAttribute('pointer-events','none');g.setAttribute('aria-label','Contacte virtual sense adreça digital');
  const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx','0');circle.setAttribute('cy','0');circle.setAttribute('r','9');circle.setAttribute('fill','#6d45b5');circle.setAttribute('stroke','#fff');circle.setAttribute('stroke-width','1.5');circle.setAttribute('stroke-dasharray','2 2');
  const label=document.createElementNS(ns,'text');label.setAttribute('x','0');label.setAttribute('y','3.5');label.setAttribute('text-anchor','middle');label.setAttribute('font-size','9');label.setAttribute('font-weight','700');label.setAttribute('fill','#fff');label.textContent='V';
  const title=document.createElementNS(ns,'title');title.textContent=items.map(x=>x.name).join(', ')+' · Contacte virtual · sense adreça digital';
  g.append(circle,label,title);piece.append(g);
 });
}
function refreshBlocks(){
 const select=$('virtualContactBlock');if(!select)return;const selected=select.value;select.replaceChildren();
 for(const block of blocks()){const option=document.createElement('option');option.value=block.id;option.textContent=(block.name||block.id)+(block.verified?'':' · no verificat');select.append(option);}
 if([...select.options].some(o=>o.value===selected))select.value=selected;
}
function initialize(){
 const host=$('virtualContactList');if(!host)return;
 $('virtualContactType').addEventListener('change',updateFields);$('virtualContactCreate').addEventListener('click',create);
 $('virtualContactBlock').addEventListener('change',()=>{const b=blocks().find(x=>x.id===$('virtualContactBlock').value);if(b)$('virtualContactDistance').max=String(Math.max(1,Number(b.lengthMm)-1));});
 refreshBlocks();updateFields();render();decorateSwitchboard();
 window.JMRI_TC_VIRTUAL_CONTACTS={
  updatePositionEstimate(input){
   const x=input||{};if(!x.runId||!x.blockId||x.verified!==true||x.profileVerified!==true)return{ok:false,error:'Estimació rebutjada: cal runId, bloc, posició i perfil calibrat verificats.'};
   const positionMm=x.positionMm===undefined?undefined:Number(x.positionMm),elapsedSeconds=x.elapsedSeconds===undefined?undefined:Number(x.elapsedSeconds);
   if((positionMm===undefined&&elapsedSeconds===undefined)||(positionMm!==undefined&&(!Number.isFinite(positionMm)||positionMm<0))||(elapsedSeconds!==undefined&&(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0)))return{ok:false,error:'Posició o temps no vàlids.'};
   positionEstimates.set(String(x.blockId),{runId:String(x.runId),blockId:String(x.blockId),positionMm,elapsedSeconds,verified:true,profileVerified:true});
   render();return{ok:true};
  },
  inspect(){return core.inspect(config(),{sensorStates:sensorStates(),positionEstimates:Object.fromEntries(positionEstimates)});}
 };
 window.setInterval(()=>{refreshBlocks();render();decorateSwitchboard();},1500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})();
