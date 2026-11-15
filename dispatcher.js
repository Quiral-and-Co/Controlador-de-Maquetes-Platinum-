(() => {
  'use strict';
  const core=window.JMRI_TC_DispatcherCore;
  if(!core)return;
  const $=id=>document.getElementById(id),runtime=core.createState();
  let initialized=false;
  function getConfig(){return window.JMRI_TC_DISPATCHER?.getConfig?.();}
  function allBlocks(){const c=getConfig();return(c?.levels||[]).flatMap(l=>(l.blocks||[]).map(b=>({...b,levelName:l.name,levelId:l.id})));}
  function sync(){const blocks=allBlocks(),c=getConfig();core.ensureBlocks(runtime,blocks.map(b=>b.id));core.setRoutes(runtime,c?.dispatcher?.routes||[]);return blocks;}
  function routeStatus(route){
    const statuses=route.blockIds.map(id=>runtime.blockStates[id]||'UNKNOWN');
    if(statuses.some(s=>s==='OCCUPIED'))return'OCCUPIED';
    if(statuses.some(s=>s!=='FREE'))return'UNKNOWN';
    if(route.blockIds.some(id=>runtime.reservations[id]&&runtime.reservations[id]!==route.id))return'CONFLICT';
    return route.blockIds.every(id=>runtime.reservations[id]===route.id)?'RESERVED':'READY';
  }
  function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;}
  function statusLabel(s){return({UNKNOWN:'Desconegut',FREE:'Lliure',OCCUPIED:'Ocupat'})[s]||s;}
  function routeStatusLabel(s){return({UNKNOWN:'Bloquejat · estat desconegut',OCCUPIED:'Bloquejat · bloc ocupat',CONFLICT:'Conflicte de reserva',READY:'Preparat per reservar',RESERVED:'Reservat (simulació)'})[s]||s;}
  function announce(message){$('dispatcherMessage').textContent=message;window.JMRI_TC_DISPATCHER?.log?.('[Dispatcher] '+message);}
  function refresh(){
    if(!initialized)return;
    const blocks=sync(),list=$('dispatcherBlocks');list.replaceChildren();
    if(!blocks.length)list.append(el('p','dispatcher-empty','Encara no hi ha blocs. Crea blocs al panell de recursos abans de planificar itineraris.'));
    blocks.forEach(block=>{
      const status=runtime.blockStates[block.id]||'UNKNOWN',row=el('article','dispatcher-block'),details=el('div','dispatcher-block-info');
      details.append(el('strong','',block.name||block.id));
      details.append(el('small','',block.levelName+' · '+(block.trackIds||[]).length+' peça/es · '+(block.sensorIds||[]).length+' sensor(s)'));
      details.append(el('span','dispatcher-state state-'+status.toLowerCase(),statusLabel(status)));
      const select=el('select','dispatcher-state-select');select.setAttribute('aria-label','Estat simulat del bloc '+(block.name||block.id));
      [['UNKNOWN','Desconegut'],['FREE','Lliure'],['OCCUPIED','Ocupat']].forEach(([v,label])=>{const option=el('option','',label);option.value=v;select.append(option);});
      select.value=status;select.addEventListener('change',()=>{
        const result=core.setBlockState(runtime,block.id,select.value);
        if(result.ok&&result.releasedRoutes.length)announce('Bloc '+block.name+' ha canviat d’estat; s’han alliberat els itineraris afectats.');
        else announce('Estat simulat del bloc '+block.name+': '+statusLabel(select.value)+'.');
        refresh();
      });
      row.append(details,select);
      const owner=runtime.reservations[block.id];
      if(owner)row.append(el('span','dispatcher-reservation','Reservat: '+(runtime.routes.find(r=>r.id===owner)?.name||owner)));
      list.append(row);
    });
    const routesList=$('dispatcherRoutes');routesList.replaceChildren();
    if(!runtime.routes.length)routesList.append(el('p','dispatcher-empty','No hi ha itineraris definits.'));
    runtime.routes.forEach(route=>{
      const status=routeStatus(route),row=el('article','dispatcher-route'),info=el('div','dispatcher-route-info'),actions=el('div','dispatcher-route-actions');
      info.append(el('strong','',route.name),el('small','',route.blockIds.join(' → ')),el('span','dispatcher-state state-'+status.toLowerCase(),routeStatusLabel(status)));
      const reserve=el('button','primary','Reservar');reserve.type='button';reserve.disabled=status!=='READY'&&status!=='RESERVED';
      reserve.addEventListener('click',()=>{const result=core.reserveRoute(runtime,route.id);announce(result.ok?'Itinerari '+route.name+' reservat (simulació).':result.error);refresh();});
      const release=el('button','','Alliberar');release.type='button';release.disabled=!route.blockIds.some(id=>runtime.reservations[id]===route.id);
      release.addEventListener('click',()=>{core.releaseRoute(runtime,route.id);announce('Itinerari '+route.name+' alliberat (simulació).');refresh();});
      const remove=el('button','danger','Eliminar');remove.type='button';
      remove.addEventListener('click',()=>{core.releaseRoute(runtime,route.id);const c=getConfig();c.dispatcher.routes=c.dispatcher.routes.filter(r=>r.id!==route.id);announce('Itinerari '+route.name+' eliminat del projecte.');refresh();});
      actions.append(reserve,release,remove);row.append(info,actions);routesList.append(row);
    });
    $('dispatcherFreeCount').textContent=blocks.filter(b=>runtime.blockStates[b.id]==='FREE').length;
    $('dispatcherOccupiedCount').textContent=blocks.filter(b=>runtime.blockStates[b.id]==='OCCUPIED').length;
    $('dispatcherUnknownCount').textContent=blocks.filter(b=>runtime.blockStates[b.id]==='UNKNOWN').length;
    $('dispatcherReservedCount').textContent=Object.keys(runtime.reservations).length;
  }
  function createRoute(){
    const c=getConfig();c.dispatcher=c.dispatcher||{};c.dispatcher.routes=c.dispatcher.routes||[];
    const blockIds=$('dispatcherRouteBlocks').value.split(',').map(v=>v.trim()).filter(Boolean);
    const result=core.addRoute(runtime,{id:'R-'+Date.now(),name:$('dispatcherRouteName').value,blockIds},allBlocks().map(b=>b.id));
    if(!result.ok){announce(result.error);return;}
    c.dispatcher.routes.push(result.route);$('dispatcherRouteName').value='';$('dispatcherRouteBlocks').value='';
    announce('Itinerari creat. Per defecte no està reservat.');refresh();
  }
  function initialize(){if(initialized)return;initialized=true;$('dispatcherCreateRoute').addEventListener('click',createRoute);refresh();}
  window.JMRI_TC_DISPATCHER_UI={refresh,initialize};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})();
