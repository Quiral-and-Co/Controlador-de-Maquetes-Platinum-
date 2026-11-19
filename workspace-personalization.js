(() => {
'use strict';
const KEY='quiral.workspace.preferences.v1';
const defaults={theme:'windows-light',interfaceMode:'modern',toolbar:true,taskbar:true,statusbar:true,ribbonCollapsed:false,iconSize:42,dmiFunctions:true,dmiSliders:true,dmiGaugeTouch:false,dmiBackground:'#101b29',dmiAccent:'#e0b64d',gridSize:24,trackScale:100,boardBackground:'#f5f7fa',trackColor:'#394b5e',reservedColor:'#d18b28',dispatcherMeta:true,dispatcherStatus:true,dispatcherSort:'name',trafficSort:'recent',dmiButtonSize:42,dmiSliderSize:158,autoHide:[]};
let prefs={...defaults};
try{prefs={...prefs,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{}
const $=id=>document.getElementById(id);
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{};apply();window.dispatchEvent(new CustomEvent('workspace-preferences-changed',{detail:{...prefs}}));};
function apply(){
 const body=document.body;body.dataset.uiTheme=prefs.theme;
 body.classList.toggle('ribbon-collapsed',!!prefs.ribbonCollapsed);
 const toolbar=document.querySelector('body.mode-modern .desktop-commandbar')||document.querySelector('body.mode-classic .toolbar');
 if(toolbar)toolbar.hidden=!prefs.toolbar;
 const taskbar=document.querySelector('.desktop-taskbar');if(taskbar)taskbar.hidden=!prefs.taskbar;
 document.querySelectorAll('.canvas-status,.status-bar,[data-status-bar]').forEach(n=>n.hidden=!prefs.statusbar);
 document.body.classList.toggle('dmi-touch-gauge',!!prefs.dmiGaugeTouch);
 document.documentElement.style.setProperty('--ribbon-icon-size',prefs.iconSize+'px');
 document.documentElement.style.setProperty('--dmi-panel-bg',prefs.dmiBackground);
 document.documentElement.style.setProperty('--dmi-accent',prefs.dmiAccent);
 document.documentElement.style.setProperty('--dmi-function-button-size',prefs.dmiButtonSize+'px');
 document.documentElement.style.setProperty('--dmi-slider-height',prefs.dmiSliderSize+'px');
 document.documentElement.style.setProperty('--board-background',prefs.boardBackground);
 document.documentElement.style.setProperty('--board-grid-size',prefs.gridSize+'px');
 document.documentElement.style.setProperty('--track-symbol-scale',String(prefs.trackScale/100));
 document.documentElement.style.setProperty('--track-color',prefs.trackColor);
 document.documentElement.style.setProperty('--reserved-route-color',prefs.reservedColor);
 const functions=$('dmiFunctionButtons');if(functions)functions.hidden=!prefs.dmiFunctions;
 document.querySelectorAll('.dmi-lever .dmi-vertical-range').forEach(n=>n.hidden=!prefs.dmiSliders);
 const board=document.querySelector('.canvas-wrap');if(board)board.style.backgroundColor=prefs.boardBackground;
 document.querySelectorAll('.desktop-window').forEach(win=>{const title=win.getAttribute('aria-label')||'';const key=title.toLowerCase();const auto=prefs.autoHide.some(x=>key.includes(x));win.classList.toggle('auto-hide-window',auto);});
}
function field(label,control){const wrap=document.createElement('label');wrap.className='workspace-pref-field';const name=document.createElement('span');name.textContent=label;wrap.append(name,control);return wrap;}
function select(value,options,onchange){const el=document.createElement('select');options.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;el.append(o);});el.value=String(value);el.addEventListener('change',()=>onchange(el.value));return el;}
function checkbox(value,onchange){const el=document.createElement('input');el.type='checkbox';el.checked=!!value;el.addEventListener('change',()=>onchange(el.checked));return el;}
function color(value,onchange){const el=document.createElement('input');el.type='color';el.value=value;el.addEventListener('input',()=>onchange(el.value));return el;}
function range(value,min,max,step,onchange){const el=document.createElement('input');el.type='range';el.min=min;el.max=max;el.step=step;el.value=value;el.addEventListener('input',()=>onchange(Number(el.value)));return el;}
function open(){
 let dialog=$('workspacePreferencesDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='workspacePreferencesDialog';dialog.className='workspace-preferences-dialog';dialog.innerHTML='<form method="dialog"><header><div><h2>Personalització de l’espai de treball</h2><p>Preferències visuals i d’organització · desades en aquest ordinador</p></div><button value="close" aria-label="Tancar">✕</button></header><div class="workspace-pref-grid"><section><h3>Interfície i visualització</h3><div id="workspacePrefView"></div></section><section><h3>Finestres i acoblament</h3><div id="workspacePrefWindows"></div></section><section><h3>Finestra de tren · DMI</h3><div id="workspacePrefTrain"></div></section><section><h3>Tauler de vies / Switchboard</h3><div id="workspacePrefBoard"></div></section><section><h3>Despatxador</h3><div id="workspacePrefDispatcher"></div></section></div><footer><button type="button" id="workspacePrefReset">Restaurar valors per defecte</button><button value="close" class="primary">Tancar</button></footer></form>';document.body.append(dialog);}
 const add=(id,label,node)=>$(id).append(field(label,node));
 const view=$('workspacePrefView'),wins=$('workspacePrefWindows'),train=$('workspacePrefTrain'),board=$('workspacePrefBoard'),disp=$('workspacePrefDispatcher');
 [view,wins,train,board,disp].forEach(n=>n.replaceChildren());
 add('workspacePrefView','Interfície',select(prefs.interfaceMode,[['modern','Cinta moderna (Ribbon)'],['classic','Menús clàssics i barres']],v=>{prefs.interfaceMode=v;save();document.getElementById(v==='modern'?'modeModern':'modeClassic')?.click();}));
 add('workspacePrefView','Estil visual',select(prefs.theme,[['windows-light','Windows clar'],['windows-dark','Windows fosc'],['classic-light','Clàssic clar'],['graphite','Grafit fosc']],v=>{prefs.theme=v;save();}));
 add('workspacePrefView','Barra d’eines principal',checkbox(prefs.toolbar,v=>{prefs.toolbar=v;save();}));
 add('workspacePrefView','Barra de finestres',checkbox(prefs.taskbar,v=>{prefs.taskbar=v;save();}));
 add('workspacePrefView','Barra d’estat',checkbox(prefs.statusbar,v=>{prefs.statusbar=v;save();}));
 add('workspacePrefView','Mida de les icones',select(prefs.iconSize,[['32','Petita'],['38','Mitjana'],['42','Gran'],['50','Molt gran']],v=>{prefs.iconSize=Number(v);save();}));
 add('workspacePrefView','Cinta minimitzada',checkbox(prefs.ribbonCollapsed,v=>{prefs.ribbonCollapsed=v;save();}));
 add('workspacePrefWindows','Ocultació automàtica dels panells laterals',checkbox(prefs.autoHide.includes('nivells'),v=>{prefs.autoHide=v?[...new Set([...prefs.autoHide,'nivells'])]:prefs.autoHide.filter(x=>x!=='nivells');save();}));
 add('workspacePrefWindows','Auto-ocultar inspector i propietats',checkbox(prefs.autoHide.includes('propietats'),v=>{prefs.autoHide=v?[...new Set([...prefs.autoHide,'propietats'])]:prefs.autoHide.filter(x=>x!=='propietats');save();}));
 const info=document.createElement('p');info.className='workspace-pref-note';info.textContent='Fes servir la fletxa de cada finestra per acoblar-la o deixar-la flotant. Les finestres flotants es poden moure dins l’escriptori; la separació real a un segon monitor necessita una finestra nativa independent.';wins.append(info);
 add('workspacePrefTrain','Mostrar botons F0–F32',checkbox(prefs.dmiFunctions,v=>{prefs.dmiFunctions=v;save();}));
 add('workspacePrefTrain','Mostrar controls lliscants',checkbox(prefs.dmiSliders,v=>{prefs.dmiSliders=v;save();}));
 add('workspacePrefTrain','Velocímetre tàctil (clic per fixar consigna)',checkbox(prefs.dmiGaugeTouch,v=>{prefs.dmiGaugeTouch=v;save();}));
 add('workspacePrefTrain','Mida dels botons de funció',select(prefs.dmiButtonSize,[['34','Petita'],['42','Mitjana'],['50','Gran']],v=>{prefs.dmiButtonSize=Number(v);save();}));
 add('workspacePrefTrain','Alçada dels controls lliscants',select(prefs.dmiSliderSize,[['120','120 px'],['158','158 px'],['190','190 px'],['220','220 px']],v=>{prefs.dmiSliderSize=Number(v);save();}));
 add('workspacePrefTrain','Color de fons DMI',color(prefs.dmiBackground,v=>{prefs.dmiBackground=v;save();}));
 add('workspacePrefTrain','Color d’accent DMI',color(prefs.dmiAccent,v=>{prefs.dmiAccent=v;save();}));
 add('workspacePrefBoard','Mida de quadrícula',select(prefs.gridSize,[['12','12 px'],['16','16 px'],['20','20 px'],['24','24 px'],['32','32 px'],['40','40 px']],v=>{prefs.gridSize=Number(v);save();}));
 add('workspacePrefBoard','Escala dels símbols de via',select(prefs.trackScale,[['70','70%'],['85','85%'],['100','100%'],['115','115%'],['130','130%']],v=>{prefs.trackScale=Number(v);save();}));
 add('workspacePrefBoard','Color de fons del tauler',color(prefs.boardBackground,v=>{prefs.boardBackground=v;save();}));
 add('workspacePrefBoard','Color de les vies',color(prefs.trackColor,v=>{prefs.trackColor=v;save();}));
 add('workspacePrefBoard','Color de rutes reservades',color(prefs.reservedColor,v=>{prefs.reservedColor=v;save();}));
 add('workspacePrefDispatcher','Mostrar informació secundària de blocs',checkbox(prefs.dispatcherMeta,v=>{prefs.dispatcherMeta=v;save();}));
 add('workspacePrefDispatcher','Mostrar columna d’estat',checkbox(prefs.dispatcherStatus,v=>{prefs.dispatcherStatus=v;save();}));
 add('workspacePrefDispatcher','Ordenar blocs per',select(prefs.dispatcherSort,[['name','Nom'],['status','Estat'],['level','Nivell']],v=>{prefs.dispatcherSort=v;save();}));
 add('workspacePrefDispatcher','Ordenar trens actius per',select(prefs.trafficSort,[['recent','Activitat recent'],['locomotive','Locomotora'],['route','Itinerari'],['status','Estat']],v=>{prefs.trafficSort=v;save();}));
 $('workspacePrefReset').onclick=()=>{prefs={...defaults};save();dialog.close();open();};
 if(!dialog.open)dialog.showModal();
}
document.addEventListener('contextmenu',event=>{if(event.target.closest('.modern-ribbon')){event.preventDefault();prefs.ribbonCollapsed=!prefs.ribbonCollapsed;save();}});
document.addEventListener('click',event=>{if(event.target.closest('.modern-ribbon .ribbon-tab[data-ribbon-tab="view"]'))setTimeout(apply,0);});
window.JMRI_TC_WORKSPACE_PREFS=Object.freeze({get(key){return prefs[key];},open,apply,set(key,value){if(!(key in defaults))return false;prefs[key]=value;save();return true;}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();
