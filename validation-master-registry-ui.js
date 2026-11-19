(() => {
'use strict';
const root=window,core=root.JMRI_TC_ValidationMasterRegistry,physical=root.JMRI_TC_PhysicalValidationCore;
if(!core||!physical)return;
const $=id=>document.getElementById(id);const checkpoint=()=>root.JMRI_TC_DISPATCHER?.checkpoint?.();let timer=null,installed=false,snapshotPersistenceInFlight=false,snapshotPersistencePending=false,lastPersistence={ok:false,error:'Encara no s’ha desat cap canvi.'};
const LEGACY_STORAGE_KEY='jmri-tc-validation-master-registry-v1';
function createProjectId(){return 'JMRI-TC-PROJECT-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}
function state(){
 const c=root.JMRI_TC_DISPATCHER?.getConfig?.()||{},projectId=core.ensureProjectId(c,createProjectId),storageKey=core.storageKey(projectId);
 const embedded=c.validationMasterRegistry;
 let saved=core.load(root.localStorage,storageKey);
 if(saved.projectId!==projectId||(!saved.records.length&&!saved.audit.length)){
  const legacy=core.load(root.localStorage,LEGACY_STORAGE_KEY);
  saved=legacy.projectId===projectId?legacy:(embedded?.projectId===projectId?embedded:{projectId});
 }
 const s=core.createState(saved);s.projectId=projectId;core.reconcile(s,c);core.updateValidation(s,c,physical);c.validationMasterRegistry=s;
 const persistence={ok:!!root.navigator?.locks?.request,saved:lastPersistence.ok,error:root.navigator?.locks?.request?'':(lastPersistence.error||'El navegador no ofereix bloqueig transaccional; escriptures desactivades.')};
 return{c,s,persistence,storageKey};
}
async function persistTransaction(snapshot,mutate){
 if(!root.navigator?.locks?.request)return{ok:false,error:'No hi ha suport per a bloqueig transaccional entre finestres.'};
 return root.navigator.locks.request('jmri-tc-vmr:'+snapshot.storageKey,{mode:'exclusive'},async()=>{
  const latest=core.load(root.localStorage,snapshot.storageKey);
  const s=core.createState(latest.projectId===snapshot.s.projectId?latest:snapshot.s);s.projectId=snapshot.s.projectId;
  core.reconcile(s,snapshot.c);core.updateValidation(s,snapshot.c,physical);
  const before=core.serialize(s);
  const result=mutate(s);
  if(result?.ok===false)return result;
  if(core.serialize(s)!==before){
   const saved=core.save(s,root.localStorage,snapshot.storageKey);
   if(!saved.ok)return saved;
  }
  snapshot.c.validationMasterRegistry=s;lastPersistence={ok:true,error:''};
  return{ok:true,result,state:s};
 });
}
function persistSnapshot(snapshot){
 if(!root.navigator?.locks?.request)return;
 if(snapshotPersistenceInFlight){snapshotPersistencePending=true;return;}
 snapshotPersistenceInFlight=true;
 persistTransaction(snapshot,()=>({ok:true})).catch(error=>{lastPersistence={ok:false,error:String(error?.message||error)};console.warn('[Registre VMR] Persistència transaccional fallida:',error);})
 .finally(()=>{snapshotPersistenceInFlight=false;if(snapshotPersistencePending){snapshotPersistencePending=false;const fresh=state();persistSnapshot(fresh);}});
}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function render(){const host=$('validationMasterRegistry');if(!host)return;const {c,s,persistence,storageKey}=state();host.replaceChildren();
 const summary=document.createElement('p');summary.textContent='Registres: '+s.records.filter(r=>r.present!==false).length+' · esdeveniments: '+s.audit.length+' · projecte JSON: actualitzat en memòria · navegador: '+(persistence.saved?'últim canvi desat amb bloqueig exclusiu':persistence.ok?'desament transaccional disponible':'BLOQUEJAT: '+persistence.error);host.append(summary);
 const table=document.createElement('div');table.className='validation-registry-list';
 s.records.filter(r=>r.present!==false).forEach(r=>{const row=document.createElement('article');row.className='validation-entry '+String(r.status).toLowerCase().replaceAll('_','-');const title=document.createElement('strong');title.textContent=r.registryId+' · '+r.name+' · '+r.status;row.append(title);const meta=document.createElement('p');meta.textContent=r.type+' · ID font: '+r.sourceId+(r.levelName?' · '+r.levelName:'');row.append(meta);table.append(row);});host.append(table);
 const controls=document.createElement('div');controls.className='signal-controls';
 const act=document.createElement('button');act.type='button';act.textContent='Generar acta Markdown + JSON';act.addEventListener('click',()=>{const fresh=state(),a=core.buildAct(fresh.s,fresh.c);download(a.id+'.md',a.markdown,'text/markdown;charset=utf-8');download(a.id+'.json',JSON.stringify(a,null,2),'application/json');});controls.append(act);
 const json=document.createElement('button');json.type='button';json.textContent='Exportar registre JSON';json.addEventListener('click',()=>download('validation-master-registry.json',core.serialize(s),'application/json'));controls.append(json);
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Actualitzar registre';refresh.addEventListener('click',render);controls.append(refresh);host.append(controls);
 const note=document.createElement('label');note.textContent='Anotació de traçabilitat ';const input=document.createElement('input');input.type='text';input.placeholder='Nota de revisió / incidència';note.append(input);const add=document.createElement('button');add.type='button';add.textContent='Afegir nota';add.disabled=!persistence.ok;add.addEventListener('click',async()=>{const id=s.records.find(r=>r.present!==false)?.registryId;if(!id){alert('No hi ha elements al registre.');return;}checkpoint();add.disabled=true;try{const result=await persistTransaction({c,s,storageKey},fresh=>core.appendNote(fresh,id,input.value));if(!result.ok)alert(result.error||'No s’ha pogut desar la nota.');else{input.value='';render();}}catch(error){alert('Error de persistència: '+String(error?.message||error));}finally{add.disabled=false;}});note.append(add);host.append(note);persistSnapshot({c,s,storageKey});
}
function install(){if(installed||!$('validationMasterRegistry'))return;installed=true;render();timer=setInterval(render,2500);}
root.JMRI_TC_VALIDATION_MASTER_REGISTRY_UI={refresh:render,stop(){if(timer)clearInterval(timer);timer=null;}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
