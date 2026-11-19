(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const GRID = 10, CONNECT_TOLERANCE = 20, BOARD = Object.freeze({width:3000,height:1800});
  function readPreferredInterfaceMode(){try{if(/[?&]nativePanel=/.test(window.location.search||''))return 'modern';const saved=JSON.parse(localStorage.getItem('quiral.workspace.preferences.v1')||'{}');return saved.interfaceMode==='classic'?'classic':'modern';}catch(_){return 'modern';}}
  const state = {
    config: {schemaVersion:3,name:'Maqueta Märklin H0 · 5 nivells',scale:'H0',trackSystem:'Märklin C',room:{widthMm:3000,heightMm:1800},levelSpacingMm:110,
      levels:Array.from({length:5},(_,i)=>({id:i+1,name:`Nivell ${i+1}`,elevationMm:i*110,tracks:[],blocks:[],sensors:[]})),connections:[]},
    selectedLevel:1, selectedIds:[], filePath:null, isDirty:false, mode:readPreferredInterfaceMode(), drag:null, ws:null, wsHeartbeat:null, lastWsPong:0, sensors:{}, turnouts:{}, sensorUpdatedAt:{}, turnoutUpdatedAt:{}, powerUpdatedAt:0, jmriPower:'UNKNOWN', history:[], future:[], measuring:false, measureStart:null, portMode:false, pendingPort:null, viewBox:{x:0,y:0,width:3000,height:1800}, pan:null, spaceHeld:false,
  };
  const nativeSearch = typeof window.location?.search === 'string' ? window.location.search : '';
  const nativeWindowIdMatch = nativeSearch.match(/[?&]nativeWindowId=([^&]*)/);
  const nativeWindowId = nativeWindowIdMatch ? decodeURIComponent(nativeWindowIdMatch[1].replace(/\+/g, ' ')) : 'main';
  let applyingRemoteWorkspaceState = false;
  const level = () => state.config.levels.find(x=>x.id===state.selectedLevel);
  const pieces = () => level()?.tracks || [];
  const log = msg => {const li=document.createElement('li');li.textContent=`${new Date().toLocaleTimeString()} · ${msg}`;$('eventLog').prepend(li);while($('eventLog').children.length>35)$('eventLog').lastElementChild.remove();};
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const snap = n => Math.round(Number(n)/GRID)*GRID;
  const pieceName = t => ({straight:'Recta',curve:'Corba',turnout:'Desviament',block:'Bloc lògic',special:'Peça especial'})[t]||t;
  let pieceSequence=0;
  function makePiece(type){
    const existing=new Set(state.config.levels.flatMap(l=>(l.tracks||[]).map(p=>String(p.id))));
    let id;
    do { pieceSequence+=1; id=type.toUpperCase()+'-'+Date.now().toString(36)+'-'+pieceSequence.toString(36); } while(existing.has(id));
    return {id,type,name:pieceName(type)+' '+(pieces().length+1),x:snap(300+pieces().length*30),y:snap(300+pieces().length*25),rotation:0,zMm:Number(level()?.elevationMm)||0,levelId:state.selectedLevel,blockId:'',sensorName:'',turnoutSystemName:'',geometry:{lengthMm:180,radiusMm:360,angleDeg:30}};
  }
  function localPorts(p){const g=p.geometry||{};const len=Math.max(20,Number(g.lengthMm)||180);if(p.type==='straight')return [{x:0,y:0,port:'A'},{x:len,y:0,port:'B'}];if(p.type==='curve')return trackJunction.curvePorts(Math.max(20,Number(g.radiusMm)||360),Math.max(1,Math.min(179,Number(g.angleDeg)||30)),g.curveDirection||'right');if(p.type==='turnout')return trackJunction.turnoutPorts(len,Math.min(120,Number(g.branchOffsetMm)||60),(p.catalogueRef==='24624'||p.junctionKind==='double-slip')?'double-slip':'normal');return [{x:0,y:0,port:'A'},{x:len,y:0,port:'B'}];}
  function worldPorts(p){const a=(p.rotation||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return localPorts(p).map(q=>({x:p.x+q.x*c-q.y*s,y:p.y+q.x*s+q.y*c,port:q.port,pieceId:p.id}));}
  function sleeperPath(length,step=20){let d='';for(let x=10;x<length;x+=step)d+=` M${x} -9v18`;return d;}
  function pathFor(p){const g=p.geometry||{},len=Math.max(20,Number(g.lengthMm)||180);if(p.type==='straight')return `<path class="rail" d="M0 0 H${len}"/><path class="sleeper" d="${sleeperPath(len)}"/>`;if(p.type==='curve'){const a=Math.max(1,Math.min(179,Number(g.angleDeg)||30))*Math.PI/180,r=Math.max(20,Number(g.radiusMm)||360),x=r*Math.sin(a),sign=g.curveDirection==='left'?-1:1,y=sign*r*(1-Math.cos(a)),sweep=sign>0?1:0;return `<path class="rail" d="M0 0 A${r} ${r} 0 0 ${sweep} ${x} ${y}"/>`;}if(p.type==='turnout'){const off=Math.min(120,Number(g.branchOffsetMm)||60);if(p.catalogueRef==='24624'||p.junctionKind==='double-slip')return `<path class="rail" d="M0 0 L${len} ${-off} M0 ${-off} L${len} 0"/><path class="sleeper" d="${sleeperPath(len,25)}"/>`;return `<path class="rail" d="M0 0 H${len} M0 0 L${len*.83} ${-off}"/><path class="sleeper" d="${sleeperPath(len,25)}"/>`;}return `<rect class="block-shape" x="0" y="-14" width="${len}" height="28" rx="5"/><path class="rail" d="M0 0 H${len}"/>`;}
  const clone = value => JSON.parse(JSON.stringify(value));
  const viewport = window.JMRI_TC_VIEWPORT;
  if(!viewport)throw new Error('No s’ha carregat viewport-core.js abans de app.js.');
  const selectionMove = window.JMRI_TC_SELECTION_MOVE;
  if(!selectionMove)throw new Error('No s’ha carregat selection-move-core.js abans de app.js.');
  const trackJunction = window.JMRI_TC_TRACK_JUNCTION;
  if(!trackJunction)throw new Error('No s’ha carregat track-junction-core.js abans de app.js.');
  const editCommands = window.JMRI_TC_EDIT_COMMANDS;
  if(!editCommands)throw new Error('No s’ha carregat edit-commands-core.js abans de app.js.');
  function applyViewBox(){const v=state.viewBox;$('trackSvg').setAttribute('viewBox',`${v.x} ${v.y} ${v.width} ${v.height}`);$('zoomReadout').textContent=`${Math.round(viewport.zoomPercent(v,BOARD))}%`;}
  function viewportCenter(){return {x:state.viewBox.x+state.viewBox.width/2,y:state.viewBox.y+state.viewBox.height/2};}
  function zoomViewport(factor,anchor){state.viewBox=viewport.zoomAt(state.viewBox,factor,anchor,BOARD);applyViewBox();}
  function fitViewport(){state.viewBox=viewport.fit(BOARD);applyViewBox();}
  function updateHistoryButtons(){ $('undoBtn').disabled=!state.history.length; $('redoBtn').disabled=!state.future.length; }
  function checkpoint(){state.isDirty=true;state.history.push(clone(state.config));if(state.history.length>100)state.history.shift();state.future=[];updateHistoryButtons();}
  function checkpointFrom(before){state.isDirty=true;state.history.push(before);if(state.history.length>100)state.history.shift();state.future=[];updateHistoryButtons();}
  function restoreConfig(config){state.config=clone(config);state.isDirty=true;$('configName').textContent='* '+$('configName').textContent.replace(/^\* /,'');/* Keep selection IDs across undo/redo so a redo can restore the selected item. */render();updateHistoryButtons();}
  function undo(){if(!state.history.length)return;state.future.push(clone(state.config));restoreConfig(state.history.pop());log('Canvi desfet.');}
  function redo(){if(!state.future.length)return;state.history.push(clone(state.config));restoreConfig(state.future.pop());log('Canvi refet.');}
  function render(){
    const lev=level();$('levelCount').textContent=state.config.levels.length;$('pieceCount').textContent=state.config.levels.reduce((n,l)=>n+(l.tracks||[]).length,0);$('connectionCount').textContent=(state.config.connections||[]).length;$('blockCount').textContent=state.config.levels.reduce((n,l)=>n+(l.blocks||[]).length,0);
    const assigned=state.config.levels.flatMap(l=>l.tracks||[]).filter(p=>p.sensorName);$('unknownCount').textContent=assigned.filter(p=>state.sensors[p.sensorName]===undefined).length;
    $('levelList').replaceChildren();state.config.levels.forEach(l=>{const b=document.createElement('button');b.className='level-btn'+(l.id===state.selectedLevel?' selected':'');b.innerHTML=`<span>${esc(l.name)}</span><small>${(l.tracks||[]).length} peces</small>`;b.onclick=()=>{state.selectedLevel=l.id;state.selectedIds=[];render();};$('levelList').append(b);});
    $('currentLevelTitle').textContent=lev.name;$('currentLevelSubtitle').textContent=`Cota ${lev.elevationMm} mm · ${lev.tracks.length} peces · coordenades en mm`;
    renderPieces();renderProperties();renderRegistries();renderModern();renderSensors();updateHistoryButtons();window.JMRI_TC_DISPATCHER_UI?.refresh?.();window.JMRI_TC_TRAFFIC_UI?.refresh?.();window.JMRI_TC_SCHEDULE_UI?.refresh?.();window.JMRI_TC_OPERATION_UI?.refresh?.();window.JMRI_TC_SIGNALLING_UI?.refresh?.();$('endpointText').textContent=`ws://${$('host').value}:${$('port').value}/json/`;
    publishWorkspaceState();
  }
  function publishWorkspaceState(){
    if(applyingRemoteWorkspaceState || !window.jmriDesktop?.publishWorkspaceState) return;
    const payload={kind:'app-state',sourceId:nativeWindowId,config:clone(state.config),selectedLevel:state.selectedLevel,selectedIds:[...state.selectedIds],viewBox:{...state.viewBox},filePath:state.filePath,isDirty:state.isDirty,sensors:{...state.sensors},turnouts:{...state.turnouts},sensorUpdatedAt:{...state.sensorUpdatedAt},turnoutUpdatedAt:{...state.turnoutUpdatedAt},powerUpdatedAt:state.powerUpdatedAt,jmriPower:state.jmriPower};
    window.jmriDesktop.publishWorkspaceState(payload).catch(error=>console.warn('[Espai de treball] No s’ha pogut sincronitzar l’estat:',error));
  }
  function applyWorkspaceState(payload){
    if(!payload || payload.kind!=='app-state' || !payload.config || !Array.isArray(payload.config.levels)) return false;
    applyingRemoteWorkspaceState=true;
    try {
      state.config=clone(payload.config);
      state.selectedLevel=state.config.levels.some(item=>item.id===payload.selectedLevel)?payload.selectedLevel:state.config.levels[0]?.id;
      state.selectedIds=Array.isArray(payload.selectedIds)?payload.selectedIds.filter(id=>state.config.levels.some(item=>(item.tracks||[]).some(piece=>piece.id===id))):[];
      if(payload.viewBox && ['x','y','width','height'].every(key=>Number.isFinite(payload.viewBox[key]))) state.viewBox={...payload.viewBox};
      state.filePath=typeof payload.filePath==='string'?payload.filePath:null;
      state.isDirty=payload.isDirty===true;
      state.sensors=payload.sensors&&typeof payload.sensors==='object'?{...payload.sensors}:{};
      state.turnouts=payload.turnouts&&typeof payload.turnouts==='object'?{...payload.turnouts}:{};
      state.sensorUpdatedAt=payload.sensorUpdatedAt&&typeof payload.sensorUpdatedAt==='object'?{...payload.sensorUpdatedAt}:{};
      state.turnoutUpdatedAt=payload.turnoutUpdatedAt&&typeof payload.turnoutUpdatedAt==='object'?{...payload.turnoutUpdatedAt}:{};
      state.powerUpdatedAt=Number(payload.powerUpdatedAt)||0;
      state.jmriPower=typeof payload.jmriPower==='string'?payload.jmriPower:'UNKNOWN';
      render();applyViewBox();
    } finally { applyingRemoteWorkspaceState=false; }
    return true;
  }
  function sensorStateFor(p,sourceLevel=level()){
    if(!p.sensorName)return {code:'NONE',label:'Sense sensor'};
    const sensor=sourceLevel?.sensors?.find(x=>x.systemName===p.sensorName),raw=state.sensors[p.sensorName];
    if(!sensor||sensor.verified!==true||raw===undefined)return {code:'UNKNOWN',label:'Sensor desconegut'};
    let active=Number(raw)===2||String(raw).toUpperCase()==='ACTIVE';
    if(Number(raw)!==2&&Number(raw)!==4&&String(raw).toUpperCase()!=='ACTIVE'&&String(raw).toUpperCase()!=='INACTIVE')return {code:'UNKNOWN',label:'Sensor desconegut'};
    if(sensor.invert)active=!active;
    return active?{code:'OCCUPIED',label:'Ocupat'}:{code:'FREE',label:'Lliure'};
  }
  function turnoutStateFor(p){
    if(!p.turnoutSystemName)return {code:'NONE',label:'Sense desviament JMRI'};
    const accessory=window.JMRI_TC_DIGITAL_CATALOGUE?.getDatabase?.().accessories?.find(x=>x.systemName===p.turnoutSystemName&&x.type==='TURNOUT'),raw=state.turnouts[p.turnoutSystemName];
    if(raw===undefined)return {code:'UNKNOWN',label:'Desviament desconegut'};
    const value=Number(raw);
    if(value===2)return {code:'CLOSED',label:accessory?.verified===true?'Recte':'Recte · no verificat'};
    if(value===4)return {code:'THROWN',label:accessory?.verified===true?'Branca':'Branca · no verificat'};
    return {code:'UNKNOWN',label:'Desviament desconegut'};
  }
  function applySensorReading(name,value){if(!name)return;state.sensors[name]=value;state.sensorUpdatedAt[name]=Date.now();render();}
  function applyTurnoutReading(name,value){if(!name)return;state.turnouts[name]=value;state.turnoutUpdatedAt[name]=Date.now();render();}
  function renderPieces(){const layer=$('pieceLayer'),conn=$('connectionLayer'),portLayer=$('portLayer');layer.replaceChildren();conn.replaceChildren();portLayer.replaceChildren();
    pieces().forEach(p=>{const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('transform',`translate(${p.x} ${p.y}) rotate(${p.rotation||0})`);g.dataset.id=p.id;g.dataset.blockId=String(p.blockId||'');g.classList.add('track-piece');if(p.verticalRisk)g.classList.add('vertical-risk-'+p.verticalRisk);if(state.selectedIds.includes(p.id))g.classList.add('selected');const sensor=sensorStateFor(p),turnout=turnoutStateFor(p),len=Math.max(20,Number(p.geometry?.lengthMm)||180),off=Math.min(120,Number(p.geometry?.branchOffsetMm)||60);
      const sensorMarkup=p.sensorName?`<g class="sensor-indicator ${sensor.code.toLowerCase()}" data-sensor="${esc(p.sensorName)}" data-state="${sensor.code}" aria-label="${esc(sensor.label)}"><circle cx="${len/2}" cy="28" r="12"/><text x="${len/2+17}" y="34">${esc(sensor.label)}</text></g>`:'';
      const turnoutMarkup=p.type==='turnout'&&p.turnoutSystemName?`<g class="turnout-indicator ${turnout.code.toLowerCase()}" data-turnout="${esc(p.turnoutSystemName)}" data-state="${turnout.code}" aria-label="${esc(turnout.label)}"><circle cx="${len*.83}" cy="${-off-30}" r="12"/><text x="${len*.83+17}" y="${-off-24}">${esc(turnout.label)}</text></g>`:'';
      g.innerHTML=pathFor(p)+`<text class="piece-label" x="0" y="-20">${esc(p.name)}</text>`+sensorMarkup+turnoutMarkup;g.addEventListener('pointerdown',onPieceDown);layer.append(g);});
    (state.config.connections||[]).filter(c=>c.levelId===state.selectedLevel).forEach(c=>{const a=pieces().find(p=>p.id===c.from.pieceId),b=pieces().find(p=>p.id===c.to.pieceId);if(!a||!b)return;const pa=worldPorts(a).find(x=>x.port===c.from.port),pb=worldPorts(b).find(x=>x.port===c.to.port);if(!pa||!pb)return;const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',pa.x);line.setAttribute('y1',pa.y);line.setAttribute('x2',pb.x);line.setAttribute('y2',pb.y);line.setAttribute('class','connection-line');conn.append(line);});
    pieces().forEach(p=>worldPorts(p).forEach(q=>{const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('class','track-port');g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-label',`Port ${q.port} de la peça ${p.name||p.id}`);g.dataset.pieceId=p.id;g.dataset.port=q.port;g.setAttribute('transform',`translate(${q.x} ${q.y})`);const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('r','13');c.setAttribute('class','port-dot');const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x','17');t.setAttribute('y','-15');t.setAttribute('class','port-label');t.textContent=q.port;g.append(c,t);if(state.pendingPort?.pieceId===p.id&&state.pendingPort?.port===q.port)g.classList.add('port-pending');g.addEventListener('click',onPortClick);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault?.();onPortClick({currentTarget:g,stopPropagation:()=>{}});}});portLayer.append(g);}));
  }
  function svgPoint(e){const svg=$('trackSvg'),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;return pt.matrixTransform(svg.getScreenCTM().inverse());}
  $('zoomInBtn').onclick=()=>zoomViewport(0.8,viewportCenter());
  $('zoomOutBtn').onclick=()=>zoomViewport(1.25,viewportCenter());
  $('zoomFitBtn').onclick=fitViewport;
  $('trackSvg').addEventListener('wheel',e=>{e.preventDefault();const anchor=svgPoint(e);zoomViewport(e.deltaY<0?0.85:1.18,anchor);},{passive:false});
  $('trackSvg').addEventListener('pointerdown',e=>{if(e.button!==1&&!(e.button===0&&state.spaceHeld))return;e.preventDefault();state.pan={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,view:{...state.viewBox}};$('trackSvg').classList.add('panning');$('trackSvg').setPointerCapture?.(e.pointerId);});
  function onPieceDown(e){
    if(e.button!==0||state.spaceHeld||window.JMRI_TC_AUTOTRAIN_UI?.isEnabled?.())return;
    const id=e.currentTarget.dataset.id;
    if(e.ctrlKey||e.metaKey){selectPiece(id,e);return;}
    if(!state.selectedIds.includes(id))selectPiece(id,e);
    const pt=svgPoint(e);
    const selected=pieces().filter(x=>state.selectedIds.includes(x.id));
    try{
      const plan=selectionMove.createDrag(selected,id,pt,BOARD,GRID);
      state.drag={plan,before:clone(state.config),lastDx:0,lastDy:0,moved:false};
    }catch(error){log(`No es pot moure la selecció: ${error.message}`);return;}
    $('trackSvg').setPointerCapture?.(e.pointerId);
  }
  function selectPiece(id,e){if(e.ctrlKey||e.metaKey){state.selectedIds=state.selectedIds.includes(id)?state.selectedIds.filter(x=>x!==id):[...state.selectedIds,id];}else if(!state.selectedIds.includes(id)){state.selectedIds=[id];}renderPieces();renderProperties();}
  $('trackSvg').addEventListener('pointermove',e=>{
    if(state.pan&&state.pan.pointerId===e.pointerId){
      const rect=$('trackSvg').getBoundingClientRect();
      if(rect.width>0&&rect.height>0){
        const dx=-(e.clientX-state.pan.startX)*state.pan.view.width/rect.width,dy=-(e.clientY-state.pan.startY)*state.pan.view.height/rect.height;
        state.viewBox=viewport.panBy(state.pan.view,dx,dy,BOARD);applyViewBox();
      }
      return;
    }
    const pt=svgPoint(e);
    $('cursorCoords').textContent=`X: ${Math.round(pt.x)} · Y: ${Math.round(pt.y)} mm`;
    if(!state.drag)return;
    const result=selectionMove.move(state.drag.plan,pt);
    if(result.dx===state.drag.lastDx&&result.dy===state.drag.lastDy)return;
    state.drag.lastDx=result.dx;state.drag.lastDy=result.dy;
    state.drag.moved=result.dx!==0||result.dy!==0;
    for(const position of result.positions){
      const piece=pieces().find(x=>x.id===position.id);
      if(piece){piece.x=position.x;piece.y=position.y;}
    }
    renderPieces();
    const selected=selectedPiece();
    if(selected){$('propX').value=selected.x;$('propY').value=selected.y;}
  });
  $('trackSvg').addEventListener('pointerup',e=>{
    if(state.pan&&state.pan.pointerId===e.pointerId){state.pan=null;$('trackSvg').classList.remove('panning');return;}
    if(state.drag){
      const drag=state.drag;
      if(drag.moved){
        checkpointFrom(drag.before);
        log(`${drag.plan.originals.length} peça/es moguda/es conjuntament a la graella.`);
      }
      state.drag=null;render();
    }
  });
  $('trackSvg').addEventListener('pointercancel',()=>{
    if(state.pan){state.pan=null;$('trackSvg').classList.remove('panning');}
    if(state.drag){
      state.config=clone(state.drag.before);
      state.drag=null;render();
      log('Moviment de la selecció cancel·lat; s’han restaurat les coordenades originals.');
    }
  });
  $('trackSvg').addEventListener('click',e=>{if(state.measuring){if(e.target.closest?.('.track-piece'))return;const pt=svgPoint(e);if(!state.measureStart){state.measureStart={x:pt.x,y:pt.y};$('measureStatus').textContent=`Origen: (${pt.x.toFixed(0)}, ${pt.y.toFixed(0)}) mm · tria el segon punt.`;}else{const a=state.measureStart,d=Math.hypot(pt.x-a.x,pt.y-a.y);const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',pt.x);line.setAttribute('y2',pt.y);line.setAttribute('class','measurement-line');$('connectionLayer').querySelectorAll?.('.measurement-line').forEach?.(x=>x.remove());$('connectionLayer').append(line);$('measureStatus').textContent=`Distància: ${d.toFixed(1)} mm · (${a.x.toFixed(0)}, ${a.y.toFixed(0)}) → (${pt.x.toFixed(0)}, ${pt.y.toFixed(0)})`;state.measureStart=null;}return;}if(e.target.closest?.('.track-piece')||e.target.closest?.('.track-port'))return;if(e.target===$('trackSvg')||e.target.tagName==='rect'){state.selectedIds=[];renderProperties();renderPieces();}});
  function selectedPieces(){return pieces().filter(x=>state.selectedIds.includes(x.id));}
  function selectedPiece(){return selectedPieces()[0];}
  function fillSelect(el,items,selected,emptyLabel){el.innerHTML=(emptyLabel?`<option value="">${esc(emptyLabel)}</option>`:'')+items.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');el.value=selected??'';}
  function syncRelations(l){l.blocks=l.blocks||[];l.sensors=l.sensors||[];l.blocks.forEach(b=>{b.trackIds=[];b.sensorIds=Array.isArray(b.sensorIds)?[...new Set(b.sensorIds)]:[];});for(const p of l.tracks||[]){const b=l.blocks.find(x=>x.id===p.blockId);if(b){b.trackIds.push(p.id);const sensor=l.sensors.find(x=>x.systemName===p.sensorName);if(sensor&&!b.sensorIds.includes(sensor.id))b.sensorIds.push(sensor.id);}}}
  function renderProperties(){const selected=selectedPieces(),p=selected[0];$('emptyProperties').classList.toggle('hidden',!!p);$('pieceProperties').classList.toggle('hidden',!p);$('multiEditPanel')?.classList.toggle('hidden',selected.length<2);if(selected.length>1&&$('multiEditSummary'))$('multiEditSummary').textContent=`${selected.length} peces seleccionades. Els camps compatibles s’aplicaran a totes les peces seleccionades del tipus corresponent.`;$('selectionText').textContent=p?`${selected.length} seleccionada/es · ${p.id}`:'Cap peça seleccionada';if(!p)return;$('propId').value=p.id;$('propName').value=p.name;$('propType').value=pieceName(p.type)+(p.catalogueRef?` · Märklin ${p.catalogueRef}`:'');$('propX').value=p.x;$('propY').value=p.y;$('propZ').value=Number.isFinite(Number(p.zMm))?p.zMm:(Number(level()?.elevationMm)||0);$('moveTargetX').value=p.x;$('moveTargetY').value=p.y;$('moveTargetZ').value=Number.isFinite(Number(p.zMm))?p.zMm:(Number(level()?.elevationMm)||0);$('propRotation').value=p.rotation||0;$('propLength').value=p.geometry?.lengthMm??180;$('propRadius').value=p.geometry?.radiusMm??360;$('propAngle').value=p.geometry?.angleDeg??30;$('propCurveDirection').value=p.geometry?.curveDirection||'right';$('curveDirectionField').classList.toggle('hidden',!selected.some(x=>x.type==='curve'));const isDoubleSlip=p.type==='turnout'&&(p.catalogueRef==='24624'||p.junctionKind==='double-slip');$('junctionConnectionField').classList.toggle('hidden',!selected.some(x=>x.type==='turnout'));fillSelect($('propJunctionConnection'),(isDoubleSlip?[{value:'A',label:'Connexió 1 · entrada superior'},{value:'B',label:'Connexió 2 · sortida diagonal'},{value:'C',label:'Connexió 3 · entrada inferior'},{value:'D',label:'Connexió 4 · sortida recta'}]:[{value:'A',label:'Punta d’unió dels dos itineraris'},{value:'B',label:'Via recta'},{value:'C',label:'Via desviada'}]),p.connectionPoint||'A');fillSelect($('propBlock'),level().blocks.map(b=>({value:b.id,label:b.name})),p.blockId||'','Sense bloc');fillSelect($('propSensor'),level().sensors.map(x=>({value:x.systemName,label:`${x.userName||x.systemName} (${x.systemName})`})),p.sensorName||'','Sense sensor');const accessories=window.JMRI_TC_DIGITAL_CATALOGUE?.getDatabase?.().accessories||[];fillSelect($('propTurnout'),accessories.filter(x=>x.type==='TURNOUT'&&x.systemName).map(x=>({value:x.systemName,label:`${x.name} · ${x.systemName} · ${x.protocol}${x.verified?'':' · no verificat'}`})),p.turnoutSystemName||'','Sense desviament JMRI');$('propTurnout').disabled=selected.filter(x=>x.type==='turnout').length!==1;$('moveLevelBtn').disabled=selected.length!==1;fillSelect($('propLevel'),state.config.levels.map(l=>({value:String(l.id),label:`${l.name} · ${l.elevationMm} mm`})),String(p.levelId),'Nivell actual');}
  function renderRegistries(){const l=level();$('blockRegistry').innerHTML=l.blocks.length?l.blocks.map(b=>`<div class="resource-row"><strong>${esc(b.name)}</strong><span>${(b.trackIds||[]).length} peça/es · ${(b.sensorIds||[]).length} sensor(s)</span><label><input type="checkbox" data-verify-block="${esc(b.id)}" ${b.verified?'checked':''}> Bloc verificat físicament</label></div>`).join(''):'Sense blocs definits.';$('sensorRegistry').innerHTML=l.sensors.length?l.sensors.map(x=>`<div class="resource-row"><strong>${esc(x.userName||x.systemName)}</strong><span>${esc(x.systemName)}${x.invert?' · invertit':''}</span><label><input type="checkbox" data-verify-sensor="${esc(x.id)}" ${x.verified?'checked':''}> Sensor verificat físicament</label></div>`).join(''):'Sense sensors registrats.';}

  $('blockRegistry').addEventListener('change',e=>{const id=e.target?.dataset?.verifyBlock;if(!id)return;const b=level().blocks.find(x=>x.id===id);if(!b)return;checkpoint();b.verified=!!e.target.checked;render();log(`Bloc ${id}: verificació física ${b.verified?'activada':'retirada'}.`);});
  $('sensorRegistry').addEventListener('change',e=>{const id=e.target?.dataset?.verifySensor;if(!id)return;const s=level().sensors.find(x=>x.id===id);if(!s)return;checkpoint();s.verified=!!e.target.checked;render();log(`Sensor ${s.systemName}: verificació física ${s.verified?'activada':'retirada'}.`);});
  function updateProp(key,value){const targets=selectedPieces();if(!targets.length)return;const compatible=key==='connectionPoint'?targets.filter(p=>p.type==='turnout'):targets;if(!compatible.length){log('No hi ha peces seleccionades compatibles amb aquesta propietat.');return;}const anchor=targets[0],delta=Number(value)-Number(anchor[key]);checkpoint();compatible.forEach((p,index)=>{if((key==='x'||key==='y')&&targets.length>1){const limit=key==='x'?BOARD.width:BOARD.height;p[key]=snap(Math.max(0,Math.min(limit,Number(p[key])+delta)));}else p[key]=key==='name'&&targets.length>1?`${value} (${index+1})`:value;});renderPieces();render();}
  $('propName').addEventListener('change',e=>updateProp('name',e.target.value));$('propX').addEventListener('change',e=>updateProp('x',Math.max(0,Math.min(3000,snap(e.target.value)))));$('propY').addEventListener('change',e=>updateProp('y',Math.max(0,Math.min(1800,snap(e.target.value)))));$('propRotation').addEventListener('change',e=>updateProp('rotation',((Number(e.target.value)%360)+360)%360));
  function updateGeometry(key,value,min,max){const selected=selectedPieces(),targets=key==='lengthMm'?selected:selected.filter(p=>p.type==='curve');if(!targets.length){log('Selecciona peces del tipus compatible per modificar aquesta geometria.');return;}checkpoint();targets.forEach(p=>{p.geometry=p.geometry||{};p.geometry[key]=Math.max(min,Math.min(max,Number(value)||min));});render();}
  $('propLength').addEventListener('change',e=>updateGeometry('lengthMm',e.target.value,20,3000));$('propRadius').addEventListener('change',e=>updateGeometry('radiusMm',e.target.value,20,3000));$('propAngle').addEventListener('change',e=>updateGeometry('angleDeg',e.target.value,1,179));$('propCurveDirection').addEventListener('change',e=>{const targets=selectedPieces().filter(p=>p.type==='curve');if(!targets.length)return;checkpoint();targets.forEach(p=>{p.geometry=p.geometry||{};p.geometry.curveDirection=e.target.value;});render();});$('propJunctionConnection').addEventListener('change',e=>updateProp('connectionPoint',e.target.value));$('propBlock').addEventListener('change',e=>{const targets=selectedPieces();if(!targets.length)return;checkpoint();targets.forEach(p=>p.blockId=e.target.value);syncRelations(level());render();log(`${targets.length} peça/es: assignació de bloc actualitzada.`);});$('propSensor').addEventListener('change',e=>{const targets=selectedPieces();if(!targets.length)return;checkpoint();targets.forEach(p=>p.sensorName=e.target.value);if(e.target.value&&state.ws&&state.ws.readyState===WebSocket.OPEN&&typeof state.ws.send==='function')state.ws.send(JSON.stringify({type:'sensor',data:{name:e.target.value}}));syncRelations(level());render();log(`${targets.length} peça/es: sensor assignat (${e.target.value||'cap'}). Estat no verificat.`);});
  $('propTurnout').addEventListener('change',e=>{const targets=selectedPieces().filter(p=>p.type==='turnout');if(targets.length!==1){log('La vinculació d’un desviament JMRI s’ha de fer peça per peça per evitar assignacions duplicades.');return;}checkpoint();targets.forEach(p=>p.turnoutSystemName=e.target.value);if(e.target.value&&state.ws&&state.ws.readyState===WebSocket.OPEN&&typeof state.ws.send==='function')state.ws.send(JSON.stringify({type:'turnout',data:{name:e.target.value}}));render();log(`${targets.length} desviament(s): vinculació JMRI actualitzada (${e.target.value||'cap'}). Control operatiu desactivat.`);});
  $('addBlockBtn').onclick=()=>{const l=level(),allBlocks=state.config.levels.flatMap(x=>x.blocks),name=$('newBlockName').value.trim()||`B${String(allBlocks.length+1).padStart(2,'0')}`;if(allBlocks.some(b=>b.name.toLowerCase()===name.toLowerCase()||b.id===name)){log(`Ja existeix el bloc ${name}.`);return;}checkpoint();l.blocks.push({id:name,name,trackIds:[],lengthMm:0,sensorIds:[],verified:false});$('newBlockName').value='';render();log(`Bloc ${name} creat com a agrupació lògica provisional.`);};
  $('addSensorBtn').onclick=()=>{const l=level(),systemName=$('newSensorSystemName').value.trim(),userName=$('newSensorUserName').value.trim();if(!systemName){log('Introdueix el system name del sensor JMRI.');return;}if(state.config.levels.some(x=>x.sensors.some(y=>y.systemName===systemName))){log(`El sensor ${systemName} ja està registrat.`);return;}checkpoint();const safe=systemName.replace(/[^a-zA-Z0-9_-]/g,'_');let sensorId=`S-${safe}`,suffix=2;while(state.config.levels.some(x=>x.sensors.some(y=>y.id===sensorId)))sensorId=`S-${safe}-${suffix++}`;l.sensors.push({id:sensorId,systemName,userName,invert:false,verified:false});$('newSensorSystemName').value='';$('newSensorUserName').value='';render();log(`Sensor ${systemName} registrat, pendent de verificació física.`);};
  $('moveLevelBtn').onclick=()=>{const p=selectedPiece(),target=state.config.levels.find(x=>String(x.id)===String($('propLevel').value));if(!p||!target||target.id===state.selectedLevel)return;if(p.blockId||p.sensorName||p.turnoutSystemName){log('Abans de moure la peça, desassigna’n el bloc, el sensor i el desviament JMRI perquè són recursos del nivell actual.');return;}if(state.config.connections.some(c=>c.from.pieceId===p.id||c.to.pieceId===p.id)){log('Abans de canviar de nivell, elimina les connexions topològiques de la peça.');return;}checkpoint();const source=level();source.tracks=source.tracks.filter(x=>x.id!==p.id);p.levelId=target.id;target.tracks.push(p);state.selectedLevel=target.id;state.selectedIds=[p.id];render();log(`${p.id} moguda a ${target.name}; no s'ha creat cap enllaç vertical.`);};

  function applyXYZSelection(){
    const selected=pieces().filter(p=>state.selectedIds.includes(p.id)).map(p=>({...p,zMm:Number.isFinite(Number(p.zMm))?Number(p.zMm):(Number(level()?.elevationMm)||0)}));
    if(!selected.length){log('Selecciona una o més vies abans d’aplicar el moviment XYZ.');return;}
    const anchor=selected[0];const delta={x:Number($('moveTargetX').value)-anchor.x,y:Number($('moveTargetY').value)-anchor.y,z:Number($('moveTargetZ').value)-anchor.zMm};
    const before=clone(state.config);
    try{
      const plan=selectionMove.moveXYZ(selected,delta,BOARD);
      checkpointFrom(before);
      for(const pos of plan.positions){const p=pieces().find(x=>x.id===pos.id);if(p){p.x=pos.x;p.y=pos.y;p.zMm=pos.zMm;}}
      render();
      log(`Posició XYZ de referència aplicada a ${plan.positions.length} peça/es: X ${$('moveTargetX').value} mm · Y ${$('moveTargetY').value} mm · Z ${$('moveTargetZ').value} mm; offsets relatius conservats.`);
    }catch(error){log(`Moviment XYZ rebutjat sense modificar el projecte: ${error.message}`);}
  }
  $('applyXYZBtn').onclick=applyXYZSelection;
  function generateParallelSelection(){
    const selected=pieces().filter(p=>state.selectedIds.includes(p.id));
    if(!selected.length){log('Selecciona una o més vies abans de generar paral·leles.');return;}
    const distance=Number($('parallelDistance').value),side=$('parallelSide').value;
    const before=clone(state.config);
    try{
      const plan=selectionMove.createParallel(selected,distance,{side,board:BOARD,idFactory:(piece,index)=>`PAR-${Date.now().toString(36)}-${index+1}-${String(piece.id).replace(/[^a-zA-Z0-9_-]/g,'_')}`});
      checkpointFrom(before);
      const copies=plan.tracks.map(copy=>({...copy,zMm:Number.isFinite(Number(copy.zMm))?Number(copy.zMm):(Number(level()?.elevationMm)||0),blockId:'',sensorName:'',turnoutSystemName:'',levelId:state.selectedLevel}));
      pieces().push(...copies);
      state.selectedIds=copies.map(p=>p.id);
      render();
      log(`Generades ${copies.length} via/es paral·lela/es a ${distance} mm pel costat ${side==='left'?'esquerre':'dret'}. Les assignacions de blocs, sensors i desviaments no s’han duplicat.`);
    }catch(error){log(`Generació paral·lela rebutjada sense modificar el projecte: ${error.message}`);}
  }
  $('createParallelBtn').onclick=generateParallelSelection;

  if(!$('rotationQuadrant').value)$('rotationQuadrant').value='0';
  if(!$('rotationCustomAngle').value)$('rotationCustomAngle').value='15';
  function selectedRotationAngle(){
    const quadrant=Number($('rotationQuadrant').value),local=Number($('rotationCustomAngle').value);
    if(!Number.isInteger(quadrant)||quadrant<0||quadrant>3||!Number.isFinite(local)||local<0||local>90)throw new RangeError('Tria un quadrant vàlid i un angle entre 0° i 90°.');
    return quadrant*90+local;
  }
  function refreshRotationReadout(){
    try{$('rotationAngleReadout').textContent=`Angle total: ${Number(selectedRotationAngle().toFixed(2))}° · sentit horari al tauler`;}
    catch(error){$('rotationAngleReadout').textContent=error.message;}
  }
  function rotateSelectionBy(angle){
    const selected=pieces().filter(p=>state.selectedIds.includes(p.id));
    if(!selected.length){log('Selecciona una o més peces abans de girar.');return;}
    const total=((Number(angle)%360)+360)%360;
    if(!Number.isFinite(total)){log('L’angle de rotació no és vàlid.');return;}
    if(Math.abs(total)<1e-9){log('Rotació de 0°: no s’ha modificat cap peça.');return;}
    const selectedIds=new Set(selected.map(p=>p.id));
    const affected=(state.config.connections||[]).filter(c=>c.levelId===state.selectedLevel&&(selectedIds.has(c.from?.pieceId)||selectedIds.has(c.to?.pieceId)));
    const before=clone(state.config);
    let plan;
    try{plan=selectionMove.rotate(selected,total,BOARD);}catch(error){log(`No es pot girar la selecció: ${error.message}`);return;}
    for(const position of plan.positions){
      const piece=pieces().find(p=>p.id===position.id);
      if(piece){piece.x=position.x;piece.y=position.y;piece.rotation=position.rotation;}
    }
    checkpointFrom(before);
    render();
    const audit=auditTopology();
    log(`Rotació conjunta de ${selected.length} peça/es +${Number(total.toFixed(2))}° al centre (${plan.center.x.toFixed(1)}, ${plan.center.y.toFixed(1)}) mm; ${affected.length} connexió/ons afectada/es revisada/es. ${audit.errors.length?'Cal revisar els errors topològics i, si escau, desfer l’operació.':'Cap error topològic detectat.'}`);
  }
  $('rotateBtn').onclick=()=>{try{rotateSelectionBy(selectedRotationAngle());}catch(error){log(error.message);}};
  $('rotationQuadrant').addEventListener('change',refreshRotationReadout);
  $('rotationCustomAngle').addEventListener('input',refreshRotationReadout);
  $('rotationCustomAngle').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('rotateBtn').onclick();}});
  [0,30,45,60,90].forEach(degrees=>{
    const button=$(`rotationPreset${degrees}`);
    button.onclick=()=>{
      $('rotationCustomAngle').value=String(degrees);
      refreshRotationReadout();
      $('rotateBtn').onclick();
    };
  });
  refreshRotationReadout();
  $('duplicateBtn').onclick=()=>{const originals=state.selectedIds.map(id=>pieces().find(p=>p.id===id)).filter(Boolean);if(!originals.length)return;checkpoint();const copies=originals.map((p,i)=>({...clone(p),id:`${p.type.toUpperCase()}-${Date.now()}-${i+1}`,name:`${p.name} (còpia)`,x:snap(Math.min(3000,p.x+40)),y:snap(Math.min(1800,p.y+40))}));pieces().push(...copies);state.selectedIds=copies.map(p=>p.id);render();log(`${copies.length} peça/es duplicada/es.`);};
  $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
  $('measureBtn').onclick=()=>{state.measuring=!state.measuring;state.measureStart=null;$('measureBtn').classList.toggle('active',state.measuring);$('measureStatus').textContent=state.measuring?'Mesura activa: fes clic a dos punts del tauler.':'Graella: 10 mm · major: 100 mm';log(state.measuring?'Eina de mesura activada.':'Eina de mesura desactivada.');};
  document.addEventListener('keydown',e=>{const tag=e.target?.tagName?.toLowerCase();if(e.code==='Space'&&!['input','textarea','select','button'].includes(tag)){state.spaceHeld=true;$('trackSvg').classList.add('space-pan-ready');e.preventDefault();return;}if(['input','textarea','select'].includes(tag))return;const mod=e.ctrlKey||e.metaKey;if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}else if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();$('duplicateBtn').onclick();}else if(mod&&e.key.toLowerCase()==='c'){e.preventDefault();copySelectedPieces();}else if(mod&&e.key.toLowerCase()==='x'){e.preventDefault();cutSelectedPieces();}else if(mod&&e.key.toLowerCase()==='v'){e.preventDefault();pastePieces();}else if(mod&&e.key.toLowerCase()==='a'){e.preventDefault();selectAllPieces();}else if(e.key==='Delete'||e.key==='Backspace')deleteSelectedPieces();});
  document.addEventListener('keyup',e=>{if(e.code==='Space'){state.spaceHeld=false;$('trackSvg').classList.remove('space-pan-ready');}});
  window.addEventListener?.('blur',()=>{state.spaceHeld=false;state.pan=null;$('trackSvg').classList.remove('space-pan-ready','panning');});
  $('deleteBtn').onclick=deleteSelectedPieces;
  function copySelectedPieces(){const clipboard=editCommands.copySelection(state.config,state.selectedLevel,state.selectedIds);if(!clipboard.elements.length){log('No hi ha peces seleccionades per copiar.');return false;}state.editClipboard=clipboard;log(clipboard.elements.length+' peça/es copiades; '+clipboard.connections.length+' connexió/ons internes preservades al porta-retalls.');return true;}
  function deleteSelectedPieces(){const result=editCommands.removeSelection(state.config,state.selectedLevel,state.selectedIds);if(!result.changed)return false;checkpoint();state.config=result.config;state.selectedIds=[];syncRelations(level());render();log(result.removedIds.length+' peça/es eliminada/es; connexions afectades retirades.');return true;}
  function cutSelectedPieces(){const result=editCommands.cutSelection(state.config,state.selectedLevel,state.selectedIds);if(!result.changed)return false;checkpoint();state.config=result.config;state.editClipboard=result.clipboard;state.selectedIds=[];syncRelations(level());render();log(result.removedIds.length+' peça/es tallada/es; '+result.clipboard.connections.length+' connexió/ons internes preservades al porta-retalls.');return true;}
  function pastePieces(){const result=editCommands.pasteClipboard(state.config,state.selectedLevel,state.editClipboard,{grid:GRID,offset:40,width:BOARD.width,height:BOARD.height});if(!result.changed){log('El porta-retalls és buit o no conté elements compatibles.');return false;}checkpoint();state.config=result.config;state.selectedIds=result.addedIds;syncRelations(level());render();log(result.addedIds.length+' peça/es enganxades al nivell actual; '+result.connectionIds.length+' connexió/ons internes recreades com a no verificades.');return true;}
  function selectAllPieces(){state.selectedIds=editCommands.selectAll(state.config,state.selectedLevel);renderPieces();renderProperties();log(state.selectedIds.length+' peça/es seleccionades al nivell actual.');return state.selectedIds.length>0;}
  function portOccupied(ref){return (state.config.connections||[]).some(c=>(c.from.pieceId===ref.pieceId&&c.from.port===ref.port)||(c.to.pieceId===ref.pieceId&&c.to.port===ref.port));}
  function onPortClick(e){e.stopPropagation();if(!state.portMode)return;const ref={pieceId:e.currentTarget.dataset.pieceId,port:e.currentTarget.dataset.port};if(!state.pendingPort){if(portOccupied(ref)){log(`El port ${ref.pieceId}:${ref.port} ja està connectat.`);return;}state.pendingPort=ref;$('portStatus').textContent=`Primer port: ${ref.pieceId}:${ref.port}. Ara selecciona el segon port.`;renderPieces();return;}const first=state.pendingPort;state.pendingPort=null;if(first.pieceId===ref.pieceId){$('portStatus').textContent='Selecciona un port d’una altra peça.';renderPieces();return;}if(portOccupied(ref)){log(`El port ${ref.pieceId}:${ref.port} ja està connectat.`);$('portStatus').textContent='El segon port ja està ocupat. Torna a seleccionar el primer port.';renderPieces();return;}const a=pieces().find(p=>p.id===first.pieceId),b=pieces().find(p=>p.id===ref.pieceId);if(!a||!b)return;const pa=worldPorts(a).find(x=>x.port===first.port),pb=worldPorts(b).find(x=>x.port===ref.port),gap=Math.hypot(pa.x-pb.x,pa.y-pb.y);if(gap>1){$('portStatus').textContent=`No connectats: separació ${gap.toFixed(1)} mm (màxim 1 mm). Mou o gira les peces i torna-ho a provar.`;log(`Connexió manual rebutjada: ${gap.toFixed(1)} mm entre ports.`);renderPieces();return;}checkpoint();state.config.connections.push({id:`C-${Date.now()}`,levelId:state.selectedLevel,from:first,to:ref,verified:false,method:'manual'});$('portStatus').textContent=`Connectats ${first.pieceId}:${first.port} ↔ ${ref.pieceId}:${ref.port}. No verificat elèctricament.`;render();log(`Connexió manual exacta creada: ${first.port} ↔ ${ref.port}.`);}
  $('portModeBtn').onclick=()=>{state.portMode=!state.portMode;state.pendingPort=null;$('portModeBtn').classList.toggle('active',state.portMode);$('portModeBtn').textContent=state.portMode?'Desactivar connexió manual':'Activar connexió manual de ports';$('portStatus').textContent=state.portMode?'Mode actiu: selecciona el primer port al tauler.':'Mode desactivat.';renderPieces();};
  $('connectBtn2').onclick=()=>{if(state.selectedIds.length!==2){log('Selecciona exactament dues peces amb Ctrl/Cmd + clic.');return;}const [a,b]=state.selectedIds.map(id=>pieces().find(p=>p.id===id));let best=null;const preferredA=trackJunction.preferredPort(a),preferredB=trackJunction.preferredPort(b);const portsA=worldPorts(a).filter(p=>!preferredA||p.port===preferredA),portsB=worldPorts(b).filter(p=>!preferredB||p.port===preferredB);for(const pa of portsA)for(const pb of portsB){const d=Math.hypot(pa.x-pb.x,pa.y-pb.y);if(!best||d<best.d)best={pa,pb,d};}if(!best||best.d>CONNECT_TOLERANCE){log(`No connectades: ports separats ${best?best.d.toFixed(1):'—'} mm (màxim ${CONNECT_TOLERANCE} mm).`);return;}const exists=(state.config.connections||[]).some(c=>c.levelId===state.selectedLevel&&((c.from.pieceId===a.id&&c.from.port===best.pa.port&&c.to.pieceId===b.id&&c.to.port===best.pb.port)||(c.from.pieceId===b.id&&c.from.port===best.pb.port&&c.to.pieceId===a.id&&c.to.port===best.pa.port)));if(exists){log('Aquesta connexió ja existeix.');return;}
    checkpoint();
    // Align the chosen B port to A exactly by translating B; never rotate it implicitly.
    b.x=b.x+(best.pa.x-best.pb.x);b.y=b.y+(best.pa.y-best.pb.y);
    state.config.connections.push({id:`C-${Date.now()}`,levelId:state.selectedLevel,from:{pieceId:a.id,port:best.pa.port},to:{pieceId:b.id,port:best.pb.port},verified:false});render();log(`Connexió geomètrica creada (${best.d.toFixed(1)} mm). No implica validació elèctrica.`);};
  const catalogue = window.MARKLIN_C_CATALOGUE || {items:[]};
  function renderCatalogue(){
    const search=$('catalogueSearch'),filter=$('catalogueCategory'),list=$('catalogueList');if(!list)return;
    const categories=[...new Set(catalogue.items.map(x=>x.category))].sort();
    if(filter.options && filter.options.length<=1)categories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;filter.append(o);});
    const q=(search.value||'').trim().toLowerCase(),cat=filter.value||'all';
    const items=catalogue.items.filter(x=>(cat==='all'||x.category===cat)&&(!q||`${x.ref} ${x.name} ${x.category}`.toLowerCase().includes(q)));
    list.replaceChildren();items.forEach(item=>{const b=document.createElement('button');b.type='button';b.className='catalogue-item';b.dataset.catalogue=item.ref;b.innerHTML=`<strong>${esc(item.ref)}</strong> · ${esc(item.name)}<small>${item.geometryStatus==='confirmed'?'Geometria confirmada':item.geometryStatus==='partial'?'Geometria parcial':'Geometria esquemàtica'}</small>`;b.onclick=()=>addCataloguePiece(item);list.append(b);});
    if(!items.length){const p=document.createElement('p');p.className='small muted';p.textContent='No hi ha coincidències. Pots ampliar la biblioteca editant catalogue-marklin-c.json.';list.append(p);}
  }
  function addCataloguePiece(item){
    checkpoint();const p=makePiece(item.type);p.id=`M${item.ref}-${Date.now()}`;p.name=`${item.ref} · ${item.name}`;p.catalogueRef=item.ref;p.catalogueBrand='Märklin';p.catalogueSystem='C-Gleis';p.geometryStatus=item.geometryStatus||'unverified';p.geometry={lengthMm:item.lengthMm||180,radiusMm:item.radiusMm||360,angleDeg:item.angleDeg||30,branchOffsetMm:60,curveDirection:'right'};if(item.ref==='24624'){p.junctionKind='double-slip';p.connectionPoint='A';}else if(item.type==='turnout')p.connectionPoint='A';p.catalogueNotes=item.notes||'';
    pieces().push(p);state.selectedIds=[p.id];render();log(`Märklin C ${item.ref} inserida (${p.geometryStatus}).`);
  }
  function renderGapSuggestions(){
    const host=$('gapSuggestions');host.replaceChildren();
    const open=[];
    pieces().forEach(p=>worldPorts(p).forEach(port=>{
      if(!portOccupied({pieceId:p.id,port:port.port}))open.push({...port,levelId:p.levelId});
    }));
    const gaps=trackJunction.recommendGaps(open,catalogue.items,500);
    if(!gaps.length){const note=document.createElement('p');note.className='small muted';note.textContent='No s’han trobat buits entre ports oberts que es puguin completar amb fins a tres rectes del catàleg (tolerància 2 mm).';host.append(note);return;}
    gaps.slice(0,8).forEach((gap,index)=>{
      const card=document.createElement('div');card.className='gap-suggestion';
      const title=document.createElement('strong');title.textContent='Tram '+(index+1)+' · '+gap.distanceMm.toFixed(1)+' mm';card.append(title);
      const meta=document.createElement('p');meta.className='small muted';meta.textContent=gap.from.pieceId+':'+gap.from.port+' → '+gap.to.pieceId+':'+gap.to.port;card.append(meta);
      gap.candidates.forEach(candidate=>{
        const button=document.createElement('button');button.type='button';button.className='catalogue-item';
        button.textContent=candidate.items.map(entry=>entry.item.ref+(entry.direction?' '+(entry.direction==='left'?'esquerra':'dreta'):'')).join(' + ')+' · '+candidate.totalLengthMm.toFixed(1)+' mm';
        button.addEventListener('click',()=>insertGapCandidate(gap,candidate));card.append(button);
      });
      host.append(card);
    });
  }
  function insertGapCandidate(gap,candidate){
    const dx=gap.to.x-gap.from.x,dy=gap.to.y-gap.from.y,distance=Math.hypot(dx,dy);
    if(Math.abs(candidate.totalLengthMm-distance)>2){log('Suggeriment rebutjat: la longitud no coincideix amb el buit.');return;}
    const angle=candidate.rotationDeg,cos=Math.cos(angle*Math.PI/180),sin=Math.sin(angle*Math.PI/180);
    const created=[];
    for(const placement of candidate.placements){
      const item=placement.item,piece=makePiece(item.type);
      piece.id='GAP-'+item.ref+'-'+Date.now().toString(36)+'-'+created.length;
      piece.name=item.ref+' · '+item.name;piece.catalogueRef=item.ref;piece.catalogueBrand='Märklin';piece.catalogueSystem='C-Gleis';piece.geometryStatus=item.geometryStatus;
      piece.geometry={lengthMm:item.lengthMm||180,radiusMm:item.radiusMm||360,angleDeg:item.angleDeg||30,branchOffsetMm:60,curveDirection:placement.direction||'right'};
      piece.x=gap.from.x+placement.x*cos-placement.y*sin;piece.y=gap.from.y+placement.x*sin+placement.y*cos;
      piece.rotation=angle+placement.rotationDeg;piece.levelId=gap.from.levelId;piece.zMm=Number(level()?.elevationMm)||0;
      created.push(piece);
    }
    if(!created.length||created.some(p=>p.x<0||p.x>3000||p.y<0||p.y>1800)){log('Suggeriment rebutjat: les vies sortirien de la superfície.');return;}
    const before=clone(state.config);checkpoint();
    const targetLevel=state.config.levels.find(l=>String(l.id)===String(gap.from.levelId));
    if(!targetLevel){state.config=before;log('Nivell del tram no disponible.');return;}
    targetLevel.tracks.push(...created);
    const refs=[{pieceId:gap.from.pieceId,port:gap.from.port},...created.map(p=>({pieceId:p.id,port:'A'}))];
    for(let i=0;i<created.length;i++){
      if(i===0)state.config.connections.push({id:'GAP-C-'+Date.now()+'-'+i,levelId:gap.from.levelId,from:refs[0],to:refs[1],verified:false,method:'catalogue-gap-suggestion'});
      if(i>0)state.config.connections.push({id:'GAP-C-'+Date.now()+'-'+i,levelId:gap.from.levelId,from:{pieceId:created[i-1].id,port:'B'},to:{pieceId:created[i].id,port:'A'},verified:false,method:'catalogue-gap-suggestion'});
    }
    state.config.connections.push({id:'GAP-C-'+Date.now()+'-end',levelId:gap.from.levelId,from:{pieceId:created[created.length-1].id,port:'B'},to:{pieceId:gap.to.pieceId,port:gap.to.port},verified:false,method:'catalogue-gap-suggestion'});
    state.selectedLevel=gap.from.levelId;state.selectedIds=created.map(p=>p.id);render();renderGapSuggestions();
    log('S’han inserit '+created.length+' recta/es Märklin C al tram buit. Connexions geomètriques creades però no verificades elèctricament.');
  }
  $('catalogueSearch').addEventListener('input',renderCatalogue);$('catalogueCategory').addEventListener('change',renderCatalogue);$('suggestGapTracksBtn').addEventListener('click',renderGapSuggestions);renderCatalogue();
  document.querySelectorAll('[data-piece]').forEach(b=>b.onclick=()=>{checkpoint();const p=makePiece(b.dataset.piece);pieces().push(p);state.selectedIds=[p.id];render();log(`${pieceName(p.type)} afegida com a element gràfic provisional.`);});
  function validateConfig(c){
    if(!c||!Array.isArray(c.levels)||c.levels.length!==5)throw Error('El projecte ha de tenir exactament cinc nivells.');
    if(![2,3].includes(Number(c.schemaVersion)))throw Error(`Versió de model no admesa: ${c.schemaVersion}`);
    c.schemaVersion=3;const levelIds=new Set(),trackIds=new Set(),blockIds=new Set(),sensorIds=new Set(),sensorNames=new Set(),trackLevel=new Map();
    for(const l of c.levels){if(l.id===undefined||levelIds.has(String(l.id)))throw Error(`ID de nivell absent o duplicat: ${l.id??'(buit)'}`);levelIds.add(String(l.id));if(!Array.isArray(l.tracks))l.tracks=[];if(!Array.isArray(l.blocks))l.blocks=[];if(!Array.isArray(l.sensors))l.sensors=[];
      for(const p of l.tracks){if(!p.id||trackIds.has(p.id))throw Error(`ID de peça absent o duplicat: ${p.id||'(buit)'}`);trackIds.add(p.id);trackLevel.set(p.id,l.id);if(typeof p.name!=='string'||!p.name)throw Error(`Nom de peça invàlid: ${p.id}`);if(!['straight','curve','turnout','block','special'].includes(p.type))throw Error(`Tipus de peça no admès: ${p.type}`);for(const k of ['x','y','rotation'])if(!Number.isFinite(Number(p[k])))throw Error(`Coordenada/rotació no vàlida a ${p.id}`);if(Number(p.x)<0||Number(p.x)>3000||Number(p.y)<0||Number(p.y)>1800)throw Error(`La peça ${p.id} queda fora de la superfície 3000 × 1800 mm.`);p.levelId=l.id;p.blockId=p.blockId||'';p.sensorName=p.sensorName||'';p.turnoutSystemName=p.turnoutSystemName||'';}
      // Migra assignacions de text de v2 a registres explícits, sempre no verificats.
      for(const p of l.tracks){if(p.blockId&&!l.blocks.some(b=>b.id===p.blockId))l.blocks.push({id:p.blockId,name:p.blockId,trackIds:[],lengthMm:0,sensorIds:[],verified:false,importedPlaceholder:true});if(p.sensorName&&!l.sensors.some(x=>x.systemName===p.sensorName)){const safe=p.sensorName.replace(/[^a-zA-Z0-9_-]/g,'_');let id=`S-${safe}`;let n=2;while(sensorIds.has(id)||l.sensors.some(x=>x.id===id))id=`S-${safe}-${n++}`;l.sensors.push({id,systemName:p.sensorName,userName:p.sensorName,invert:false,verified:false,importedPlaceholder:true});}}
      for(const b of l.blocks){if(!b.id||blockIds.has(b.id))throw Error(`ID de bloc absent o duplicat: ${b.id||'(buit)'}`);blockIds.add(b.id);if(typeof b.name!=='string'||!b.name)throw Error(`Nom de bloc invàlid: ${b.id}`);if(!Array.isArray(b.trackIds))b.trackIds=[];if(!Array.isArray(b.sensorIds))b.sensorIds=[];if(!Number.isFinite(Number(b.lengthMm)))b.lengthMm=0;if(typeof b.verified!=='boolean')b.verified=false;}
      for(const x of l.sensors){if(!x.id||sensorIds.has(x.id))throw Error(`ID de sensor absent o duplicat: ${x.id||'(buit)'}`);sensorIds.add(x.id);if(!x.systemName||sensorNames.has(x.systemName))throw Error(`System name de sensor absent o duplicat: ${x.systemName||'(buit)'}`);sensorNames.add(x.systemName);if(typeof x.verified!=='boolean')x.verified=false;if(typeof x.invert!=='boolean')x.invert=false;}
      for(const p of l.tracks){if(p.blockId&&!l.blocks.some(b=>b.id===p.blockId))throw Error(`La peça ${p.id} referencia un bloc inexistent.`);if(p.sensorName&&!l.sensors.some(x=>x.systemName===p.sensorName))throw Error(`La peça ${p.id} referencia un sensor inexistent.`);}syncRelations(l);
    }
    if(!Array.isArray(c.connections))c.connections=[];const connectionIds=new Set();for(const x of c.connections){if(!x.id||connectionIds.has(x.id))throw Error(`ID de connexió absent o duplicat: ${x.id||'(buit)'}`);connectionIds.add(x.id);if(!trackIds.has(x.from?.pieceId)||!trackIds.has(x.to?.pieceId))throw Error(`Connexió ${x.id} apunta a una peça inexistent.`);if(x.from.pieceId===x.to.pieceId)throw Error(`Connexió ${x.id} no pot unir una peça amb ella mateixa.`);if(trackLevel.get(x.from.pieceId)!==trackLevel.get(x.to.pieceId)||String(x.levelId)!==String(trackLevel.get(x.from.pieceId)))throw Error(`Connexió ${x.id} travessa nivells diferents o té levelId incorrecte.`);if(typeof x.verified!=='boolean')x.verified=false;}
    return c;
  }
  // Auditoria topològica local: no crea ni modifica connexions i no parla amb el maquinari.
  function auditTopology(){
    const errors=[],warnings=[],occupied=new Map(),known=new Map(),allPieces=new Map();
    for(const l of state.config.levels)for(const p of (l.tracks||[])){allPieces.set(p.id,{piece:p,level:l});for(const q of worldPorts(p))known.set(`${p.id}:${q.port}`,{...q,piece:p,levelId:l.id});}
    const seen=new Set();
    for(const c of (state.config.connections||[])){
      const a=known.get(`${c.from?.pieceId}:${c.from?.port}`),b=known.get(`${c.to?.pieceId}:${c.to?.port}`);
      if(!a||!b){errors.push(`Connexió ${c.id}: port o peça inexistent.`);continue;}
      if(String(a.levelId)!==String(c.levelId)||String(b.levelId)!==String(c.levelId)){errors.push(`Connexió ${c.id}: nivell inconsistent.`);continue;}
      const key1=`${c.from.pieceId}:${c.from.port}`,key2=`${c.to.pieceId}:${c.to.port}`;
      const canonical=[key1,key2].sort().join('|');
      if(seen.has(canonical))errors.push(`Connexió duplicada entre ${key1} i ${key2}.`);seen.add(canonical);
      for(const k of [key1,key2]){if(occupied.has(k))errors.push(`Port ${k} utilitzat per més d’una connexió.`);else occupied.set(k,c.id);}
      const gap=Math.hypot(a.x-b.x,a.y-b.y);
      if((a.piece.geometryStatus&&a.piece.geometryStatus!=='confirmed')||(b.piece.geometryStatus&&b.piece.geometryStatus!=='confirmed'))warnings.push(`Connexió ${c.id}: inclou una peça amb geometria parcial/no verificada; no certifica l’encaix físic.`);
      if(gap>1)errors.push(`Connexió ${c.id}: discontinuïtat geomètrica de ${gap.toFixed(1)} mm (tolerància 1 mm).`);
      if(a.pieceId===b.pieceId)errors.push(`Connexió ${c.id}: auto connexió no permesa.`);
    }
    let open=0;
    for(const [key] of known)if(!occupied.has(key))open++;
    if(open)warnings.push(`${open} port(s) sense connexió. És normal en un plànol incomplet.`);
    const summary=`Topologia: ${errors.length} error(s), ${warnings.length} avís(os), ${known.size} ports, ${occupied.size} ports connectats. ${errors.length?'Revisa els errors abans de continuar.':'No s’han detectat errors estructurals.'}${errors.length?' Detall: '+errors.join(' '):''}${warnings.length?' '+warnings.join(' '):''}`;
    $('topologyReport').textContent=summary;$('topologyReport').className=`small ${errors.length?'topology-error':'topology-ok'}`;
    log(summary);return {errors,warnings,ports:known.size,connectedPorts:occupied.size};
  }
  $('validateTopologyBtn').onclick=auditTopology;

  function setProjectName(name){$('configName').textContent=(state.isDirty?'* ':'')+(name||'Projecte nou');}
  function downloadText(content,name,type='text/plain'){
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;a.style.display='none';document.body.append(a);
    // Keep the anchor attached briefly: Chromium can otherwise cancel a Blob download
    // when the initiating node is removed in the same task as the click.
    a.click();
    window.setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},10000);
  }
  async function confirmDiscard(){
    if(!state.isDirty)return true;
    if(window.jmriDesktop?.confirmDiscard)return window.jmriDesktop.confirmDiscard();
    return window.confirm('Hi ha canvis sense desar. Vols descartar-los?');
  }
  async function openNativeProject(importMode){
    if(!await confirmDiscard())return;
    if(!window.jmriDesktop?.openProject){log('Els diàlegs natius només estan disponibles a la versió d’escriptori.');return;}
    const file=await window.jmriDesktop.openProject({importXtc:importMode===true});if(file.canceled)return;
    const ext=(file.fileName.split('.').pop()||'').toLowerCase();
    try{
      if(ext==='json'){
        const parsed=validateConfig(JSON.parse(file.content));state.config=parsed;state.filePath=file.filePath;state.isDirty=false;
        state.selectedLevel=parsed.levels[0].id;state.selectedIds=[];setProjectName(file.fileName);render();
        log('Projecte JSON obert i validat. Les assignacions no verificades continuen en estat segur.');
      }else if(['xtc','xti','xtm'].includes(ext)){
        const result=window.JMRI_TC_PROJECT_FILES.parseXtc(file.content,state.config);
        state.config=validateConfig(result.config);state.filePath=null;state.isDirty=true;state.selectedLevel=state.config.levels[0].id;state.selectedIds=[];
        setProjectName(file.fileName+' · importat');render();
        log(`XTrackCAD: ${result.report.imported} peces importades.`);
        if(result.report.unsupported.length)log('Elements XTrackCAD no convertits: '+result.report.unsupported.slice(0,12).join('; '));
      }else if(ext==='xml'){
        throw new Error('Format XML no admès; obre projectes JMRI TC JSON o fitxers XTrackCAD.');
      }else throw new Error('Format de fitxer no admès: .'+ext);
    }catch(err){log('No s’ha obert el fitxer: '+err.message);window.alert?.('No s’ha pogut obrir el fitxer. '+err.message);}
  }
  async function createProjectBackup(){if(!state.filePath||!window.jmriDesktop?.createBackup){log('Desa primer el projecte per poder crear-ne una còpia de seguretat.');return;}try{const result=await window.jmriDesktop.createBackup(state.filePath);log('Còpia de seguretat creada: '+result.fileName);}catch(err){log('No s’ha pogut crear la còpia de seguretat: '+err.message);window.alert?.(err.message);}}
  function exportSelectedElements(){const selected=state.config.levels.flatMap(l=>(l.tracks||[]).filter(p=>state.selectedIds.includes(p.id)).map(p=>({...p,levelId:l.id})));if(!selected.length){log('Selecciona elements del tauler abans d’exportar-los.');return;}const ids=new Set(selected.map(p=>p.id));const payload={format:'jmri-tc-elements',version:1,elements:selected,connections:(state.config.connections||[]).filter(c=>ids.has(c.from?.pieceId)&&ids.has(c.to?.pieceId))};downloadText(JSON.stringify(payload,null,2),'JMRI_TC_elements.json','application/json');log(selected.length+' element(s) exportat(s) a JSON.');}
  async function importSelectedElements(file){try{const data=JSON.parse(await file.text());if(data.format!=='jmri-tc-elements'||data.version!==1||!Array.isArray(data.elements))throw Error('Fitxer d’elements no compatible. Utilitza un JSON exportat des de JMRI TC Gold Custom.');const target=level();if(!target)throw Error('No hi ha cap nivell actiu.');const existing=new Set(state.config.levels.flatMap(l=>(l.tracks||[]).map(p=>String(p.id))));const map=new Map();const imported=data.elements.map((p,i)=>{if(!p||!['straight','curve','turnout','block','special'].includes(p.type)||!Number.isFinite(Number(p.x))||!Number.isFinite(Number(p.y)))throw Error('El fitxer conté un element invàlid.');let id=p.id,seq=i;while(!id||existing.has(String(id)))id='IMP-'+Date.now().toString(36)+'-'+seq++;existing.add(String(id));map.set(p.id,id);return {...p,id,levelId:target.id,zMm:Number(target.elevationMm)||0,x:snap(Math.max(0,Math.min(BOARD.width,Number(p.x)))),y:snap(Math.max(0,Math.min(BOARD.height,Number(p.y))))};});checkpoint();target.tracks.push(...imported);for(const c of (data.connections||[])){const from=map.get(c.from?.pieceId),to=map.get(c.to?.pieceId);if(from&&to)state.config.connections.push({...c,id:'IMP-C-'+Date.now().toString(36)+'-'+state.config.connections.length,levelId:target.id,from:{...c.from,pieceId:from},to:{...c.to,pieceId:to},verified:false});}state.selectedIds=imported.map(p=>p.id);state.isDirty=true;render();log(imported.length+' element(s) importat(s) al nivell actiu. Connexions importades no verificades.');}catch(err){log('Error important elements: '+err.message);window.alert?.(err.message);}}
  function openElementsImport(){const input=$('elementsImportFile');if(input)input.click();else log('No està disponible el selector d’importació d’elements.');}
  function preferenceStorage(){try{return typeof localStorage!=='undefined'?localStorage:null;}catch(_){return null;}}
  async function showPreferences(){const storage=preferenceStorage();const current=Number(storage?.getItem('jmriTcAutosaveMinutes')||0);const answer=window.prompt('Desament automàtic en minuts (0 desactivat; 5, 10 o 15). Només s’aplica a projectes que ja tenen una ruta desada.',String(current));if(answer===null)return;const minutes=Number(answer);if(![0,5,10,15].includes(minutes)){window.alert('Introdueix 0, 5, 10 o 15 minuts.');return;}if(!storage){window.alert('L’emmagatzematge de preferències no està disponible en aquest entorn.');return;}storage.setItem('jmriTcAutosaveMinutes',String(minutes));log('Preferències desades: desament automàtic '+(minutes?minutes+' min':'desactivat')+'.');}
  let autosaveTimer=null;
  function configureAutosave(){if(autosaveTimer)clearInterval(autosaveTimer);const minutes=Number(preferenceStorage()?.getItem('jmriTcAutosaveMinutes')||0);if(minutes>0)autosaveTimer=setInterval(()=>{if(state.isDirty&&state.filePath)saveNativeProject(false).catch(err=>log('Error en desament automàtic: '+err.message));},minutes*60000);}
  configureAutosave();
  async function saveNativeProject(saveAs=false){
    if(!window.jmriDesktop?.saveProject){downloadText(JSON.stringify(state.config,null,2),'JMRI_TC_Gold_Custom_layout.json','application/json');log('Projecte exportat en JSON.');return;}
    state.config.levels.forEach(syncRelations);
    const result=await window.jmriDesktop.saveProject({content:JSON.stringify(state.config,null,2),filePath:state.filePath,saveAs,defaultPath:state.filePath||'JMRI_TC_Gold_Custom_layout.json',filters:[{name:'Projecte JMRI TC (JSON)',extensions:['json']}]});
    if(result.canceled)return;
    state.filePath=result.filePath;state.isDirty=false;setProjectName(result.fileName);log('Projecte desat: '+result.fileName);
  }
  async function newProject(){
    if(!await confirmDiscard())return;
    state.config=window.JMRI_TC_PROJECT_FILES?.baseConfig?.()||{schemaVersion:3,name:'Projecte nou',scale:'H0',trackSystem:'Märklin C',room:{widthMm:3000,heightMm:1800},levelSpacingMm:110,levels:Array.from({length:5},(_,i)=>({id:i+1,name:'Nivell '+(i+1),elevationMm:i*110,tracks:[],blocks:[],sensors:[]})),connections:[]};
    state.filePath=null;state.isDirty=false;state.selectedLevel=1;state.selectedIds=[];state.history=[];state.future=[];setProjectName('Projecte nou');render();log('Projecte nou creat.');
  }
  async function exportXtc(){
    try{
      const result=window.JMRI_TC_PROJECT_FILES.exportXtc(state.config);
      if(window.jmriDesktop?.saveProject){
        const saved=await window.jmriDesktop.saveProject({content:result.content,saveAs:true,defaultPath:'JMRI_TC_Gold_Custom_layout.xtc',filters:[{name:'XTrackCAD Layout (*.xtc)',extensions:['xtc']}]});
        if(!saved.canceled)log('Exportació XTrackCAD: '+result.report.exported+' peces.');
      }else downloadText(result.content,'JMRI_TC_Gold_Custom_layout.xtc','text/plain');
      if(result.report.unsupported.length)log('No exportats a XTrackCAD: '+result.report.unsupported.join('; '));
    }catch(err){log('Error exportant XTrackCAD: '+err.message);}
  }
  $('exportBtn').onclick=()=>saveNativeProject(true);
  $('elementsImportFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)await importSelectedElements(f);e.target.value='';});
  $('configFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const c=validateConfig(JSON.parse(await f.text()));state.config=c;state.filePath=null;state.isDirty=false;state.selectedLevel=c.levels[0].id;state.selectedIds=[];setProjectName(f.name);render();log('Importat '+f.name+' i normalitzat al model v3.');}catch(err){log('Error d’importació: '+err.message);}e.target.value='';};
  $('newProjectBtn')?.addEventListener('click',newProject);
  $('openProjectBtn')?.addEventListener('click',()=>openNativeProject(false));
  $('saveProjectBtn')?.addEventListener('click',()=>saveNativeProject(false));
  $('saveAsProjectBtn')?.addEventListener('click',()=>saveNativeProject(true));
  $('importXtcBtn')?.addEventListener('click',()=>openNativeProject(true));
  $('exportXtcBtn')?.addEventListener('click',exportXtc);
  let trainEditMode=false;
  function trainRoster(){if(!window.JMRI_TC_TRAIN_ROSTER)throw new Error('Mòdul de gestió de trens no carregat.');state.config.trainRoster=window.JMRI_TC_TRAIN_ROSTER.ensure(state.config.trainRoster||{});return state.config.trainRoster;}
  function trainPrompt(message,value=''){return window.prompt(message,value);}
  function trainCreateEngine(){const panel=$('trafficLocoName')?.closest('.dispatcher-subpanel');panel?.scrollIntoView?.({behavior:'smooth',block:'center'});$('trafficLocoName')?.focus?.();log('Nova locomotora: completa el nom, el tipus d’adreça i l’adreça al registre de locomotores. L’alta no adquireix el control ni habilita DCC.');}
  function trainCreateCar(){const name=trainPrompt('Nom del nou vagó/cotxe:');if(name===null)return;const type=(trainPrompt('Tipus: PASSENGER o FREIGHT','PASSENGER')||'PASSENGER').toUpperCase();const length=trainPrompt('Longitud en mm (20–2000):','200');if(length===null)return;checkpoint();const result=window.JMRI_TC_TRAIN_ROSTER.addCar(trainRoster(),{name,type,lengthMm:Number(length)});if(!result.ok){state.history.pop();state.isDirty=false;updateHistoryButtons();log(result.error);return;}render();log('Creat '+result.car.name+' ('+result.car.id+').');}
  function trainCreateSet(){const name=trainPrompt('Nom de la nova composició fixa:');if(name===null)return;checkpoint();const result=window.JMRI_TC_TRAIN_ROSTER.addTrainSet(trainRoster(),{name});if(!result.ok){state.history.pop();state.isDirty=false;updateHistoryButtons();log(result.error);return;}render();log('Composició fixa creada: '+result.trainSet.name+'. Afegeix-hi vagons amb Acoblar.');}
  function trainCreate(){const name=trainPrompt('Nom del nou tren:');if(name===null)return;const engines=state.config.traffic?.locomotives||[];const engineId=trainPrompt('ID de la locomotora registrada (opcional): '+engines.map(x=>x.id+' · '+x.name).join(' | '),'');if(engineId===null)return;if(engineId&&!engines.some(x=>x.id===engineId)){log('La locomotora indicada no existeix al registre.');return;}checkpoint();const result=window.JMRI_TC_TRAIN_ROSTER.addTrain(trainRoster(),{name,engineId});if(!result.ok){state.history.pop();state.isDirty=false;updateHistoryButtons();log(result.error);return;}render();log('Tren creat: '+result.train.name+' ('+result.train.id+').');}
  function trainList(){const r=trainRoster(),engines=state.config.traffic?.locomotives||[];const lines=[...engines.map(e=>e.id+' · Locomotora: '+e.name+' · adreça '+e.wiThrottleId),...r.trains.map(t=>t.id+' · '+t.name+' · '+(engines.find(e=>e.id===t.engineId)?.name||'Sense locomotora')+' · '+t.carIds.length+' vagons'),...r.trainSets.map(x=>x.id+' · Composició: '+x.name+' · '+x.carIds.length+' vagons'),...r.cars.map(x=>x.id+' · '+x.name+' · '+x.type+(x.trainId?' · acoblat a tren':x.trainSetId?' · a composició fixa':' · lliure'))];log(lines.length?'Registre de trens: '+lines.join(' || '):'El registre de trens és buit.');}
  function trainProperties(){const r=trainRoster(),engines=state.config.traffic?.locomotives||[],id=trainPrompt('ID de locomotora, tren, composició o vagó per editar propietats:');if(id===null)return;const entity=r.trains.find(x=>x.id===id)||r.cars.find(x=>x.id===id)||r.trainSets.find(x=>x.id===id)||engines.find(x=>x.id===id);if(!entity){log('No s’ha trobat cap element amb aquest ID.');return;}const name=trainPrompt('Nom:',entity.name);if(name===null)return;if(!String(name).trim())return log('El nom no pot quedar buit.');checkpoint();entity.name=String(name).trim();render();log('Propietats actualitzades per a '+id+'.');}
  function trainSpeedProfile(){const engines=state.config.traffic?.locomotives||[];if(!engines.length){log('Registra primer una locomotora al menú Tren.');return;}const id=trainPrompt('ID de la locomotora: '+engines.map(x=>x.id+' · '+x.name).join(' | '),engines[0].id);if(id===null)return;if(!engines.some(x=>x.id===id)){log('Locomotora no trobada.');return;}const max=trainPrompt('Velocitat màxima estimada en km/h (1–500):','120');if(max===null)return;checkpoint();const result=window.JMRI_TC_TRAIN_ROSTER.setSpeedProfile(trainRoster(),id,{maxKmh:Number(max),points:[{step:0,kmh:0},{step:126,kmh:Number(max)}]});if(!result.ok){state.history.pop();state.isDirty=false;updateHistoryButtons();log(result.error);return;}render();log('Perfil guardat com a estimació manual no verificada. No és un calibratge real i no habilita conducció.');}
  function trainCoupling(attach){const r=trainRoster(),targetType=(trainPrompt('Destí: TRAIN o SET?','TRAIN')||'TRAIN').toUpperCase();if(!['TRAIN','SET'].includes(targetType)){log('Destí no vàlid.');return;}const targets=targetType==='SET'?r.trainSets:r.trains,targetId=trainPrompt('ID del '+(targetType==='SET'?'conjunt':'tren')+': '+targets.map(x=>x.id+' · '+x.name).join(' | '));if(targetId===null)return;const carId=trainPrompt('ID del vagó/cotxe: '+r.cars.map(x=>x.id+' · '+x.name).join(' | '));if(carId===null)return;checkpoint();const result=targetType==='SET'?(attach?window.JMRI_TC_TRAIN_ROSTER.coupleToSet(r,targetId,carId):window.JMRI_TC_TRAIN_ROSTER.uncoupleFromSet(r,targetId,carId)):(attach?window.JMRI_TC_TRAIN_ROSTER.couple(r,targetId,carId):window.JMRI_TC_TRAIN_ROSTER.uncouple(r,targetId,carId));if(!result.ok){state.history.pop();state.isDirty=false;updateHistoryButtons();log(result.error);return;}render();log(attach?'Acoblament registrat al model del projecte.':'Desacoblament registrat al model del projecte. Cap moviment físic executat.');}
  function trainDelete(){if(!trainEditMode){log('Eliminació bloquejada: activa primer «mode d’edició de trens».');return;}const kind=(trainPrompt('Què vols eliminar? Escriu TRAIN, SET o CAR:','TRAIN')||'').toLowerCase();const id=trainPrompt('ID exacte de l’element que vols eliminar:');if(id===null)return;const active=window.JMRI_TC_TRAFFIC_CONTROL?.getSnapshot?.()?.activeRun;checkpoint();const result=window.JMRI_TC_TRAIN_ROSTER.remove(trainRoster(),kind,id,{editMode:trainEditMode,activeEngineIds:active?[active.locomotiveId]:[]});if(!result.ok){state.history.pop();state.isDirty=false;updateHistoryButtons();log(result.error);return;}render();log('Element eliminat del registre del projecte.');}
  function trainOperations(){$('dispatcherTitle')?.scrollIntoView?.({behavior:'smooth',block:'start'});$('trafficLocoName')?.closest('.dispatcher-subpanel')?.scrollIntoView?.({behavior:'smooth',block:'center'});log('Operacions de tren: es mostren els registres i planificacions del Dispatcher. L’inici de circulacions, adquisició i automatització física continuen bloquejats.');}
  function trainLocked(command){const labels={trainAcquire:'Adquirir control',trainRelease:'Alliberar control',trainStop:'Aturar',trainReverse:'Invertir sentit',trainEmergency:'Aturada d’emergència',trainFunctions:'Funcions auxiliars'};log((labels[command]||'Ordre de tren')+' BLOQUEJAT: DCC i sortides físiques deshabilitats; cal validació fail-safe i autorització independent.');}
  function showHelp(topic='quick'){
    const dialog=$('helpDialog');if(!dialog){log('El centre d’ajuda no està disponible.');return;}
    const key=({contents:'contents',shortcuts:'shortcuts',diagnostics:'diagnostics',about:'about'})[topic]||topic;
    dialog.querySelectorAll('[data-help-topic]').forEach(button=>{const active=button.dataset.helpTopic===key;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    dialog.querySelectorAll('[data-help-section]').forEach(section=>{section.hidden=section.dataset.helpSection!==key;});
    if(!dialog.open)dialog.showModal();
  }
  $('helpDialog')?.querySelectorAll?.('[data-help-topic]')?.forEach(button=>button.addEventListener('click',()=>showHelp(button.dataset.helpTopic)));
  $('helpDialogClose')?.addEventListener('click',()=> $('helpDialog')?.close());
  function handleAppCommand(command){
    if(command==='workspacePreferences')window.JMRI_TC_WORKSPACE_PREFS?.open?.();
    else if(command==='toggleToolbar'){const p=window.JMRI_TC_WORKSPACE_PREFS;p?.set?.('toolbar',!(p.get('toolbar')!==false));}
    else if(command==='toggleTaskbar'){const p=window.JMRI_TC_WORKSPACE_PREFS;p?.set?.('taskbar',!(p.get('taskbar')!==false));}
    else if(command==='toggleStatusbar'){const p=window.JMRI_TC_WORKSPACE_PREFS;p?.set?.('statusbar',!(p.get('statusbar')!==false));}
    else if(command==='toggleRibbon'){const p=window.JMRI_TC_WORKSPACE_PREFS;p?.set?.('ribbonCollapsed',!p.get('ribbonCollapsed'));}
    else if(command==='new')newProject();
    else if(command==='open')openNativeProject(false);
    else if(command==='save')saveNativeProject(false);
    else if(command==='saveAs')saveNativeProject(true);
    else if(command==='importXtc')openNativeProject(true);
    else if(command==='exportXtc')exportXtc();
    else if(command==='backup')createProjectBackup();
    else if(command==='importElements')openElementsImport();
    else if(command==='exportElements')exportSelectedElements();
    else if(command==='pageSetup')window.jmriDesktop?.pageSetup?.().then(r=>log(r.success?'Diàleg de configuració d’impressió completat.':'Impressió no completada: '+r.failureReason));
    else if(command==='printPreview')window.jmriDesktop?.printPreview?.().then(()=>log('Vista prèvia PDF oberta amb el visor del sistema.')).catch(err=>log('Error en la vista prèvia: '+err.message));
    else if(command==='print')window.jmriDesktop?.printDocument?.().then(r=>log(r.success?'Document enviat a la cua d’impressió.':'Impressió cancel·lada o fallida: '+r.failureReason));
    else if(command==='preferences'){showPreferences().then(configureAutosave);}
    else if(command==='setClassicMode')setMode('classic');
    else if(command==='setModernMode')setMode('modern');
    else if(command==='windowShowAll'){if(window.JMRI_TC_DESKTOP?.getWindows?.().length)window.JMRI_TC_DESKTOP.showAll();else window.scrollTo({top:0,behavior:'smooth'});}
    else if(command==='windowMinimizeAll')window.JMRI_TC_DESKTOP?.minimizeAll?.();
    else if(command==='windowCascade')window.JMRI_TC_DESKTOP?.cascade?.();
    else if(command==='windowTile')window.JMRI_TC_DESKTOP?.tile?.();
    else if(command==='windowTileTwoColumns')window.JMRI_TC_DESKTOP?.tilePreset?.('two-columns');
    else if(command==='windowTileColumns')window.JMRI_TC_DESKTOP?.tilePreset?.('columns');
    else if(command==='windowDockLeft')window.JMRI_TC_DESKTOP?.dock?.('left');
    else if(command==='windowDockRight')window.JMRI_TC_DESKTOP?.dock?.('right');
    else if(command==='windowDockTop')window.JMRI_TC_DESKTOP?.dock?.('top');
    else if(command==='windowDockBottom')window.JMRI_TC_DESKTOP?.dock?.('bottom');
    else if(command==='windowRestoreLayout'){if(window.JMRI_TC_DESKTOP?.getWindows?.().length)window.JMRI_TC_DESKTOP.restoreLayout();else window.scrollTo({top:0,behavior:'smooth'});}
    else if(command==='windowShowEditor'){if(!window.JMRI_TC_DESKTOP?.focusWindow?.('Tauler de disseny'))$('currentLevelTitle')?.scrollIntoView?.({behavior:'smooth',block:'start'});}
    else if(command==='windowShowDispatcher'){if(!window.JMRI_TC_DESKTOP?.focusWindow?.('Despatxador'))$('dispatcherTitle')?.scrollIntoView?.({behavior:'smooth',block:'start'});}
    else if(command==='windowShowTraffic'){if(!window.JMRI_TC_DESKTOP?.focusWindow?.('Gestió de circulacions'))$('trafficTitle')?.scrollIntoView?.({behavior:'smooth',block:'start'});}
    else if(command==='windowShowSchedules'){if(!window.JMRI_TC_DESKTOP?.focusWindow?.('Horaris'))$('scheduleTitle')?.scrollIntoView?.({behavior:'smooth',block:'start'});}
    else if(command==='windowShowOperation'){if(!window.JMRI_TC_DESKTOP?.focusWindow?.('Operació'))$('operationTitle')?.scrollIntoView?.({behavior:'smooth',block:'start'});}
    else if(command==='windowShowMetgeQuiral'){if(!window.JMRI_TC_DESKTOP?.focusWindow?.('Metge Quiral'))$('metgeQuiralTitle')?.scrollIntoView?.({behavior:'smooth',block:'start'});}
    else if(command==='helpQuick')showHelp('quick');
    else if(command==='helpContents')showHelp('contents');
    else if(command==='helpShortcuts')showHelp('shortcuts');
    else if(command==='helpDiagnostics')showHelp('diagnostics');
    else if(command==='helpRunMetgeQuiral'){$('helpDialog')?.close?.();$('metgeQuiralTitle')?.scrollIntoView?.({behavior:'smooth',block:'start'});$('metgeQuiralRun')?.click?.();}
    else if(command==='helpAbout')showHelp('about');
    else if(command==='undo')undo();
    else if(command==='redo')redo();
    else if(command==='cut')cutSelectedPieces();
    else if(command==='copy')copySelectedPieces();
    else if(command==='paste')pastePieces();
    else if(command==='delete')deleteSelectedPieces();
    else if(command==='duplicate')$('duplicateBtn')?.click?.();
    else if(command==='selectAll')selectAllPieces();
    else if(command==='zoomIn')zoomViewport(0.8,viewportCenter());
    else if(command==='zoomOut')zoomViewport(1.25,viewportCenter());
    else if(command==='zoomFit')fitViewport();
    else if(command==='validateTopology')auditTopology();
    else if(command==='measure')$('measureBtn').click();
    else if(command==='portMode')$('portModeBtn').click();
    else if(command==='createParallel')$('createParallelBtn').click();
    else if(command==='suggestGaps')$('suggestGapTracksBtn').click();
    else if(command==='dispatcherOpen')$('dispatcherTitle')?.scrollIntoView?.({behavior:'smooth',block:'start'});
    else if(command==='dispatcherCreateRoute'){$('dispatcherTitle')?.scrollIntoView?.({behavior:'smooth',block:'start'});$('dispatcherRouteName')?.focus?.();}
    else if(command==='trafficPlan'){$('trafficTitle')?.scrollIntoView?.({behavior:'smooth',block:'start'});$('trafficLoco')?.focus?.();}
    else if(command==='trafficList')$('trafficRunList')?.scrollIntoView?.({behavior:'smooth',block:'center'});
    else if(command==='scheduleOpen')window.JMRI_TC_SCHEDULE_UI?.open?.();
    else if(command==='scheduleCreate')window.JMRI_TC_SCHEDULE_UI?.create?.();
    else if(command==='scheduleList')window.JMRI_TC_SCHEDULE_UI?.list?.();
    else if(command==='scheduleSuccessors')window.JMRI_TC_SCHEDULE_UI?.successors?.();
    else if(command==='operationOpen')window.JMRI_TC_OPERATION_UI?.open?.();
    else if(command==='operationMacroCreate'){window.JMRI_TC_OPERATION_UI?.open?.();$('operationMacroName')?.focus?.();}
    else if(command==='operationFlagCreate'){window.JMRI_TC_OPERATION_UI?.open?.();$('operationFlagName')?.focus?.();}
    else if(command==='operationCounterCreate'){window.JMRI_TC_OPERATION_UI?.open?.();$('operationCounterName')?.focus?.();}
    else if(command==='operationEventCreate'){window.JMRI_TC_OPERATION_UI?.open?.();$('operationEventName')?.focus?.();}
    else if(command==='operationRefreshEvents')window.JMRI_TC_OPERATION_UI?.refreshEvents?.();
    else if(command==='openCommandStation'){const panel=$('commandStationPanel');panel?.scrollIntoView?.({behavior:'smooth',block:'start'});$('csName')?.focus?.({preventScroll:true});log('Configuració del sistema digital oberta. Desar un perfil no connecta ni habilita sortides físiques.');}
    else if(command==='trainNewEngine')trainCreateEngine();
    else if(command==='trainNewCar')trainCreateCar();
    else if(command==='trainNewTrainSet')trainCreateSet();
    else if(command==='trainNewTrain')trainCreate();
    else if(command==='trainList')trainList();
    else if(command==='trainProperties')trainProperties();
    else if(command==='trainSpeedProfile')trainSpeedProfile();
    else if(command==='trainCouple')trainCoupling(true);
    else if(command==='trainUncouple')trainCoupling(false);
    else if(command==='trainOperations')trainOperations();
    else if(command==='trainToggleEditMode'){trainEditMode=!trainEditMode;log('Mode d’edició de trens '+(trainEditMode?'activat':'desactivat')+'.');}
    else if(command==='trainDelete')trainDelete();
    else if(['trainAcquire','trainRelease','trainStop','trainReverse','trainEmergency','trainFunctions'].includes(command))trainLocked(command);
    else if(command==='showDigitalStatus'){const connected=state.ws?.readyState===WebSocket.OPEN&&Date.now()-state.lastWsPong<=15000;const station=window.JMRI_TC_COMMAND_STATIONS?.getDatabase?.()?.stations?.find(x=>x.id===window.JMRI_TC_COMMAND_STATIONS?.getDatabase?.()?.selectedStationId);log('Diagnòstic només lectura · JMRI: '+(connected?'connectat':'desconnectat')+' · alimentació informada: '+state.jmriPower+' · central seleccionada: '+(station?.name||'cap')+' · sortides físiques i DCC: BLOQUEJATS.');}
    else if(command==='connect')connect();
    else if(command==='disconnect')state.ws?.close();
  }
  window.jmriDesktop?.onCommand?.(handleAppCommand);

  document.querySelectorAll('[data-ribbon-command]').forEach(button=>button.addEventListener('click',()=>handleAppCommand(button.dataset.ribbonCommand)));
  document.querySelectorAll('[data-ribbon-tab]').forEach(tab=>tab.addEventListener('click',()=>{const name=tab.dataset.ribbonTab;document.querySelectorAll('[data-ribbon-tab]').forEach(x=>{const active=x===tab;x.classList.toggle('active',active);x.setAttribute('aria-selected',String(active));});document.querySelectorAll('[data-ribbon-page]').forEach(page=>{page.hidden=page.dataset.ribbonPage!==name;});}));
  function renderModern(){$('modernBlocks').replaceChildren();state.config.levels.forEach(l=>(l.tracks||[]).forEach(p=>{const card=document.createElement('article');card.className='modern-block';card.textContent=`${p.name} · ${l.name} · ${p.blockId||'Sense bloc'} · ${p.sensorName||'Sense sensor'}`;$('modernBlocks').append(card);}));}
  function renderSensors(){const rows=state.config.levels.flatMap(l=>[...(l.tracks||[]).filter(p=>p.sensorName).map(p=>`${p.sensorName}: ${sensorStateFor(p,l).label}`),...(l.tracks||[]).filter(p=>p.type==='turnout'&&p.turnoutSystemName).map(p=>`${p.turnoutSystemName}: ${turnoutStateFor(p).label}`)]);$('sensorSummary').textContent=rows.length?rows.join(' · '):'Encara no hi ha sensors ni desviaments JMRI assignats a peces.';}
  function connect(){if(state.ws?.readyState===WebSocket.OPEN)return;const host=$('host').value.trim(),port=Number($('port').value);if(!host||!Number.isInteger(port)||port<1||port>65535){log('Servidor o port invàlid.');return;}const url=`ws://${host}:${port}/json/`;$('connectionText').textContent=`Connectant a ${url}`;state.sensors={};state.turnouts={};state.sensorUpdatedAt={};state.turnoutUpdatedAt={};state.powerUpdatedAt=0;render();try{const ws=new WebSocket(url);state.ws=ws;ws.onopen=()=>{$('connectionBadge').textContent='Connectat';$('connectionBadge').className='badge online';$('connectBtn').disabled=true;$('disconnectBtn').disabled=false;$('connectionText').textContent=`WebSocket obert: ${url}`;state.lastWsPong=Date.now();state.jmriPower='UNKNOWN';ws.send(JSON.stringify({list:'sensors'}));ws.send(JSON.stringify({list:'turnouts'}));ws.send(JSON.stringify({type:'power',method:'get'}));const names=[...new Set(state.config.levels.flatMap(l=>[...(l.tracks||[]).map(p=>p.sensorName),...(l.sensors||[]).map(s=>s.systemName)]).filter(Boolean))];names.forEach(name=>ws.send(JSON.stringify({type:'sensor',data:{name}})));const turnoutNames=[...new Set(state.config.levels.flatMap(l=>(l.tracks||[]).map(p=>p.turnoutSystemName)).filter(Boolean))];turnoutNames.forEach(name=>ws.send(JSON.stringify({type:'turnout',data:{name}})));state.wsHeartbeat=setInterval(()=>{if(ws.readyState!==WebSocket.OPEN)return;if(Date.now()-state.lastWsPong>15000){log('JMRI sense resposta al heartbeat; invalidant lectures i tancant la connexió.');ws.close();return;}try{ws.send(JSON.stringify({type:'ping'}));}catch{ws.close();}},5000);log('JMRI connectat en mode només lectura. Esperant lectures actuals dels sensors.');render();};ws.onmessage=e=>{try{const m=JSON.parse(e.data),items=Array.isArray(m)?m:[m];items.forEach(x=>{if(x.type==='pong')state.lastWsPong=Date.now();if(x.type==='power'){state.jmriPower=({2:'ON',4:'OFF',8:'IDLE'})[Number(x.data?.state)]||'UNKNOWN';state.powerUpdatedAt=Date.now();}if(x.type==='sensor'&&x.data?.name){state.sensors[x.data.name]=x.data.state;state.sensorUpdatedAt[x.data.name]=Date.now();}if(x.type==='turnout'&&x.data?.name){state.turnouts[x.data.name]=x.data.state;state.turnoutUpdatedAt[x.data.name]=Date.now();}});render();}catch{log('Missatge JMRI ignorat: JSON no vàlid.');}};ws.onerror=()=>{log('Error WebSocket: revisa el Web Server de JMRI.');};ws.onclose=()=>{clearInterval(state.wsHeartbeat);state.wsHeartbeat=null;state.ws=null;state.sensors={};state.turnouts={};state.sensorUpdatedAt={};state.turnoutUpdatedAt={};state.powerUpdatedAt=0;state.jmriPower='UNKNOWN';$('connectionBadge').textContent='Desconnectat';$('connectionBadge').className='badge offline';$('connectBtn').disabled=false;$('disconnectBtn').disabled=true;$('connectionText').textContent='No hi ha cap sessió activa. Les lectures s’han invalidat.';render();log('Connexió tancada: blocs amb sensors retornats a Desconegut.');};}catch(err){state.sensors={};render();log(err.message);}}
  $('connectBtn').onclick=connect;$('disconnectBtn').onclick=()=>state.ws?.close();$('host').oninput=()=>$('endpointText').textContent=`ws://${$('host').value}:${$('port').value}/json/`;$('port').oninput=$('host').oninput;
  function setMode(m){const next=m==='classic'?'classic':'modern';const changed=state.mode!==next;state.mode=next;document.body?.classList?.toggle('mode-modern',next==='modern');try{if(window.JMRI_TC_WORKSPACE_PREFS?.set)window.JMRI_TC_WORKSPACE_PREFS.set('interfaceMode',next);else{const key='quiral.workspace.preferences.v1';const saved=JSON.parse(localStorage.getItem(key)||'{}');saved.interfaceMode=next;localStorage.setItem(key,JSON.stringify(saved));}}catch(_){}const ribbon=$('modernRibbon');if(ribbon)ribbon.hidden=next!=='modern';window.JMRI_TC_DESKTOP?.setMode?.(next);$('modeClassic')?.classList?.toggle('active',next==='classic');$('modeModern')?.classList?.toggle('active',next==='modern');$('modeClassic')?.setAttribute('aria-pressed',String(next==='classic'));$('modeModern')?.setAttribute('aria-pressed',String(next==='modern'));$('modernPanel')?.classList?.add('hidden');window.jmriDesktop?.setUiMode?.(next);if(changed)log(next==='modern'?'Escriptori modern amb cinta d’opcions i finestres flotants activat.':'Interfície clàssica restaurada.');} $('modeClassic').onclick=()=>setMode('classic');$('modeModern').onclick=()=>setMode('modern');
  window.JMRI_TC_DISPATCHER = { getConfig:()=>state.config, checkpoint:()=>checkpoint(), checkpointFrom:before=>checkpointFrom(clone(before)), refresh:()=>render(), getSensorStates:()=>{const now=Date.now(),connected=state.ws?.readyState===WebSocket.OPEN&&now-state.lastWsPong<=15000;return connected?Object.fromEntries(Object.entries(state.sensors).filter(([name])=>Number.isFinite(state.sensorUpdatedAt[name])&&now-state.sensorUpdatedAt[name]<=15000)):{};}, getPowerState:()=>state.jmriPower, isConnected:()=>state.ws?.readyState===WebSocket.OPEN, log:message=>log(message) };
  window.JMRI_TC_BOARD={getTrainEditMode:()=>trainEditMode,getSensorState:sensorStateFor,getTurnoutState:turnoutStateFor,applySensorReading,applyTurnoutReading,requestSensorReading:name=>{const systemName=String(name||'').trim();if(!/^[A-Za-z0-9_.:-]{1,80}$/.test(systemName)||state.ws?.readyState!==WebSocket.OPEN)return false;try{state.ws.send(JSON.stringify({type:'sensor',data:{name:systemName}}));return true;}catch{return false;}},getSelectedLevel:()=>state.selectedLevel,getTelemetry:()=>({connected:state.ws?.readyState===WebSocket.OPEN,lastHeartbeatAt:state.lastWsPong,sensors:{...state.sensors},turnouts:{...state.turnouts},sensorUpdatedAt:{...state.sensorUpdatedAt},turnoutUpdatedAt:{...state.turnoutUpdatedAt},power:state.jmriPower,powerUpdatedAt:state.powerUpdatedAt}),refresh:()=>render()};
  window.JMRI_TC_VIEWPORT_UI={getViewBox:()=>({...state.viewBox}),zoomIn:()=>zoomViewport(0.8,viewportCenter()),zoomOut:()=>zoomViewport(1.25,viewportCenter()),fit:fitViewport};
  const desktopApi=window.jmriDesktop;
  desktopApi?.onWorkspaceState?.(payload=>{if(payload?.sourceId!==nativeWindowId)applyWorkspaceState(payload);});
  (async()=>{
    if(nativeWindowId!=='main' && desktopApi?.getWorkspaceState){
      try { const snapshot=await desktopApi.getWorkspaceState(); if(snapshot) applyWorkspaceState(snapshot); }
      catch(error){ console.warn('[Espai de treball] No s’ha pogut recuperar l’estat inicial:',error); }
    }
    setMode(state.mode);render();applyViewBox();
  })();
})();
