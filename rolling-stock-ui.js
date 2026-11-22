'use strict';
(function(){
  const $=id=>document.getElementById(id),core=window.JMRI_TC_RollingStockCore,importer=window.JMRI_TC_RollingStockImport;
  if(!core||!importer||!$('rollingStockPanel'))return;
  let selectedId='',selectedIndex=0,editingId=null;
  const dialog=$('rollingStockEditor'),form=$('rollingStockEditorForm');
  function db(){return core.ensureDatabase(window.JMRI_TC_ROLLING_STOCK_DB?.()||{});}
  function saveDb(value){window.JMRI_TC_ROLLING_STOCK_SAVE?.(value);window.JMRI_TC_ROLLING_STOCK_UI?.refresh?.();}
  function source(){const app=window.JMRI_TC_ROLLING_STOCK_SOURCE?.()||{},snapshot=window.JMRI_TC_TRAFFIC_CONTROL?.getSnapshot?.()||{};return core.buildInventory(snapshot.locomotives||app.locomotives||[],app.roster||{},db());}
  function setStatus(message){const node=$('rollingStockStatus');if(node)node.textContent=message;}
  function jsonField(id,fallback){try{const v=JSON.parse($(id).value||fallback);if(!v||typeof v!=='object')throw new Error();return v;}catch{throw new Error('El camp '+id+' ha de contenir JSON vàlid.');}}
  function field(id,value){$(id).value=value??'';}
  function openEditor(vehicle){
    editingId=vehicle?.id||null;
    const v=vehicle||{name:'',kind:'locomotive',protocol:'DCC',addressType:'auto',functions:[{number:0,label:'Llums',icon:'lightbulb',momentary:false}],cv:{}};
    $('rollingStockEditorTitle').textContent=editingId?'Configurar vehicle · '+v.name:'Afegir vehicle al parc';
    field('rsName',v.name);field('rsKind',v.kind||'locomotive');field('rsManufacturer',v.manufacturer);field('rsModel',v.model);field('rsArticle',v.article);field('rsProtocol',String(v.protocol||'DCC').toUpperCase());field('rsAddress',v.address);field('rsAddressType',v.addressType||'auto');field('rsDecoder',v.decoder);field('rsMaxKmh',v.maxKmh);field('rsImage',v.image);field('rsDrawing',v.drawing);field('rsFunctions',JSON.stringify(v.functions||[],null,2));field('rsCv',JSON.stringify(v.cv||{},null,2));field('rsSpeedProfile',JSON.stringify(v.speedProfile||{maxKmh:v.maxKmh||null,points:[]},null,2));
    $('rollingStockDelete').hidden=!editingId;
    if(!dialog.open)dialog.showModal();$('rsName').focus();
  }
  function closeEditor(){if(dialog.open)dialog.close();editingId=null;}
  function render(){
    const host=$('rollingStockList');if(!host)return;const items=source();host.replaceChildren();
    if(!items.length){const empty=document.createElement('p');empty.className='rolling-stock-empty';empty.textContent='Parc buit. Afegeix vehicles manualment o importa una base de dades de central digital.';host.append(empty);return;}
    if(selectedIndex>=items.length)selectedIndex=items.length-1;
    items.forEach((item,index)=>{
      const row=document.createElement('button');row.type='button';row.className='rolling-stock-item';row.draggable=!!item.draggable&&item.kind!=='car';row.dataset.vehicleId=item.id;row.dataset.vehicleKind=item.kind;row.setAttribute('role','listitem');row.setAttribute('aria-selected',String(item.id===selectedId));row.classList.toggle('selected',item.id===selectedId);
      const icon=document.createElement('span');icon.className='rolling-stock-icon';const media=item.image||((String(item.drawing||'').startsWith('data:image/')||/^https?:/i.test(item.drawing||''))?item.drawing:'');if(media){const image=document.createElement('img');image.src=media;image.alt='';image.loading='lazy';icon.append(image);}else icon.textContent=item.drawing&&item.drawing.length<8?item.drawing:(item.kind==='locomotive'?'🚂':'🚃');
      const details=document.createElement('span');details.className='rolling-stock-details';const name=document.createElement('strong');name.textContent=item.name;const meta=document.createElement('small');meta.textContent=[item.kind==='locomotive'?'Locomotora':item.kind==='multiple-unit'?'Automotor':'Vehicle',item.protocol||'',item.address?'Adreça '+item.address:'',item.manufacturer||''].filter(Boolean).join(' · ');details.append(name,meta);if(Array.isArray(item.functions)&&item.functions.length){const strip=document.createElement('span');strip.className='rs-function-strip';item.functions.slice(0,8).forEach(fn=>{const chip=document.createElement('span');chip.title=fn.label||('F'+fn.number);const iconSource=String(fn.icon||'');if(iconSource.startsWith('data:image/')||/^https?:/i.test(iconSource)){const img=document.createElement('img');img.src=iconSource;img.alt=fn.label||('F'+fn.number);chip.append(img);}else chip.textContent=iconSource||('F'+fn.number);strip.append(chip);});details.append(strip);}
      const hint=document.createElement('span');hint.className='rolling-stock-drag-hint';hint.textContent=item.kind==='car'?'Vehicle':(item.controlReady===false?'No assignada al control':(item.image?'📷':'Arrossega al DMI'));row.append(icon,details,hint);
      row.addEventListener('click',()=>{selectedId=item.id;selectedIndex=index;render();setStatus('Seleccionat: '+item.name+'. Doble clic o prem Intro per configurar.');});
      row.addEventListener('dblclick',()=>openEditor(db().vehicles.find(v=>v.id===item.id)||item));
      row.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();selectedIndex=Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowDown'?1:-1)));selectedId=items[selectedIndex].id;render();host.querySelectorAll('.rolling-stock-item')[selectedIndex]?.focus();}else if(event.key==='Enter'){event.preventDefault();openEditor(db().vehicles.find(v=>v.id===item.id)||item);}});
      row.addEventListener('dragstart',event=>{selectedId=item.id;row.classList.add('selected');const payload=core.createDragPayload(item);if(!payload){event.preventDefault();setStatus('Registra primer aquesta locomotora DCC al control. Els protocols MFX/M4/MM2 necessiten el seu adaptador de central.');return;}event.dataTransfer?.setData(core.DRAG_TYPE,payload);event.dataTransfer?.setData('text/plain',payload);if(event.dataTransfer)event.dataTransfer.effectAllowed='copy';setStatus('Arrossegant '+item.name+'.');});
      host.append(row);
    });
  }
  function saveVehicle(event){
    event.preventDefault();try{
      const value={id:editingId||undefined,name:$('rsName').value,kind:$('rsKind').value,manufacturer:$('rsManufacturer').value,model:$('rsModel').value,article:$('rsArticle').value,protocol:$('rsProtocol').value,address:$('rsAddress').value,addressType:$('rsAddressType').value,decoder:$('rsDecoder').value,maxKmh:$('rsMaxKmh').value||null,image:$('rsImage').value,drawing:$('rsDrawing').value,functions:jsonField('rsFunctions','[]'),cv:jsonField('rsCv','{}'),speedProfile:jsonField('rsSpeedProfile','{\"points\":[]}'),source:editingId?(db().vehicles.find(v=>v.id===editingId)?.source||'MANUAL'):'MANUAL'};
      const result=core.upsertVehicle(db(),value);if(!result.ok)throw new Error(result.error);saveDb(db());closeEditor();selectedId=result.vehicle.id;render();setStatus('Fitxa desada: '+result.vehicle.name+'. Les CV només s’han desat localment; no s’han programat al descodificador.');
    }catch(error){setStatus(error.message);}
  }
  $('rollingStockAdd').addEventListener('click',()=>openEditor(null));
  $('rollingStockRegister').addEventListener('click',()=>{
    const selected=source().find(v=>v.id===selectedId);if(selected?.controlReady){setStatus('Aquesta locomotora ja està registrada al control.');return;}const vehicle=db().vehicles.find(v=>v.id===selectedId)||db().vehicles.find(v=>selected&&v.address&&String(v.address)===String(selected.address));
    if(!vehicle){setStatus('Selecciona primer una locomotora importada.');return;}
    if(String(vehicle.protocol||'').toUpperCase()!=='DCC'){setStatus('El registre directe al control WiThrottle només admet DCC. MFX, M4 i MM2 requereixen l’adaptador específic de la central.');return;}
    const address=Number(vehicle.address);
    if(!Number.isInteger(address)||address<1||address>10239){setStatus('L’adreça DCC importada no és vàlida. Edita la fitxa abans de registrar-la.');return;}
    const result=window.JMRI_TC_TRAFFIC_CONTROL?.registerLocomotive?.({...vehicle,address});
    if(!result?.ok){setStatus(result?.error||'No s’ha pogut registrar la locomotora al control.');return;}
    render();setStatus('Locomotora '+vehicle.name+' registrada al control DCC. Encara calen els interbloqueigs habituals abans de qualsevol moviment.');
  });

  $('rollingStockImport').addEventListener('click',()=>$('rollingStockFile').click());
  $('rollingStockFile').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{let parsed;
      if(file.name.toLowerCase().endsWith('.z21')){
        if(!window.jmriDesktop?.importZ21Database)throw new Error('La importació SQLite .z21 només està disponible a l’aplicació d’escriptori.');
        parsed=await window.jmriDesktop.importZ21Database(new Uint8Array(await file.arrayBuffer()));
      }else{
        parsed=importer.importText(file.name,await file.text());
        if(!parsed.ok)throw new Error(parsed.error);
      }
      const result=importer.mergeImport(db(),parsed.vehicles);saveDb(db());render();setStatus('Importació '+(parsed.source||'central')+': '+result.added+' afegits, '+result.updated+' actualitzats, '+result.errors.length+' errors. Revisa les fitxes importades abans de circular.');}
    catch(error){setStatus('Importació no completada: '+error.message);}finally{event.target.value='';}
  });
  $('rollingStockExport').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(db(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='parc-ferroviari-quiral.json';a.click();URL.revokeObjectURL(url);});
  form.addEventListener('submit',saveVehicle);$('rollingStockEditorClose').addEventListener('click',closeEditor);$('rollingStockCancel').addEventListener('click',closeEditor);
  $('rollingStockDelete').addEventListener('click',()=>{if(!editingId)return;if(!window.confirm('Vols eliminar aquest vehicle del parc ferroviari?'))return;const snapshot=window.JMRI_TC_TRAFFIC_CONTROL?.getSnapshot?.()||{},active=snapshot.activeRun,activeLoco=snapshot.locomotives?.find(item=>item.id===active?.locomotiveId),editing=db().vehicles.find(item=>item.id===editingId);const activeIds=active&&(active.locomotiveId===editingId||(editing?.address&&String(editing.address)===String(activeLoco?.address||activeLoco?.wiThrottleId||'')))?[editingId]:[];const result=core.removeVehicle(db(),editingId,{activeIds});if(!result.ok){setStatus(result.error);return;}saveDb(db());closeEditor();render();setStatus('Vehicle eliminat del parc.');});
  window.addEventListener('jmri:rolling-stock-discovered',event=>{
    const discovered=event.detail;
    if(!discovered||typeof discovered!=='object')return;
    const payload={...discovered,source:discovered.source||'AUTO_DISCOVERY'};
    const result=core.upsertVehicle(db(),payload);
    if(result.ok){saveDb(db());render();setStatus('Vehicle detectat i incorporat: '+result.vehicle.name+'. Revisa la identitat i les funcions abans d’habilitar-ne el control.');}
    else setStatus('Detecció no incorporada: '+result.error);
  });
  render();setInterval(render,1200);window.JMRI_TC_ROLLING_STOCK_UI={refresh:render,getSelected:()=>selectedId,openEditor};
})();
