'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const core=window.JMRI_TC_RollingStockCore;
  if(!core||!$('rollingStockPanel'))return;
  let selectedId='';
  function source(){
    const app=window.JMRI_TC_ROLLING_STOCK_SOURCE?.()||{};
    const snapshot=window.JMRI_TC_TRAFFIC_CONTROL?.getSnapshot?.()||{};
    return core.buildInventory(snapshot.locomotives||app.locomotives||[],app.roster||{});
  }
  function setStatus(message){const node=$('rollingStockStatus');if(node)node.textContent=message;}
  function render(){
    const host=$('rollingStockList');if(!host)return;
    const items=source();host.replaceChildren();
    if(!items.length){const empty=document.createElement('p');empty.className='rolling-stock-empty';empty.textContent='Encara no hi ha material mòbil registrat. Afegeix locomotores a Circulacions i vagons/cotxes al registre de trens.';host.append(empty);return;}
    items.forEach(item=>{
      const row=document.createElement('button');row.type='button';row.className='rolling-stock-item';row.draggable=true;row.dataset.vehicleId=item.id;row.dataset.vehicleKind=item.kind;row.setAttribute('role','listitem');row.classList.toggle('selected',item.id===selectedId);
      const icon=document.createElement('span');icon.className='rolling-stock-icon';icon.textContent=item.kind==='locomotive'?'🚂':'🚃';
      const details=document.createElement('span');details.className='rolling-stock-details';
      const name=document.createElement('strong');name.textContent=item.name;
      const meta=document.createElement('small');meta.textContent=item.kind==='locomotive'?'Locomotora · '+(item.address||'Adreça pendent'):((item.type==='FREIGHT'?'Vagó de mercaderies':'Cotxe de viatgers')+(item.attached?' · Assignat':' · Lliure'));
      details.append(name,meta);const hint=document.createElement('span');hint.className='rolling-stock-drag-hint';hint.textContent=item.kind==='locomotive'?'Arrossega al DMI':'Vehicle';
      row.append(icon,details,hint);
      row.addEventListener('click',()=>{selectedId=item.id;render();setStatus(item.kind==='locomotive'?'Seleccionada: '+item.name+'. Arrossega-la al panell Control de locomotora.':'Seleccionat: '+item.name+'. Els vagons i cotxes no es poden assignar al DMI.');});
      row.addEventListener('dragstart',event=>{
        selectedId=item.id;row.classList.add('selected');
        const payload=core.createDragPayload(item);
        event.dataTransfer?.setData(core.DRAG_TYPE,payload);
        event.dataTransfer?.setData('text/plain',payload);
        if(event.dataTransfer)event.dataTransfer.effectAllowed='copy';
        setStatus(item.kind==='locomotive'?'Arrossegant '+item.name+'. Deixa-la anar a una finestra DMI.':'Aquest vehicle no és una locomotora; el DMI rebutjarà l’assignació.');
      });
      host.append(row);
    });
  }
  render();setInterval(render,1200);
  window.JMRI_TC_ROLLING_STOCK_UI={refresh:render,getSelected:()=>selectedId};
})();
