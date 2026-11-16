(() => {
'use strict';
const root=window,core=root.JMRI_TC_ValidationMasterRegistry,physical=root.JMRI_TC_PhysicalValidationCore;
if(!core||!physical)return;
const $=id=>document.getElementById(id);let timer=null,installed=false;
const STORAGE_KEY='jmri-tc-validation-master-registry-v1';
function state(){const c=root.JMRI_TC_DISPATCHER?.getConfig?.()||{};let s=c.validationMasterRegistry||core.load(root.localStorage,STORAGE_KEY);if(!s.projectId||s.projectId==='default')s.projectId='jmri-tc-gold-custom';core.reconcile(s,c);core.updateValidation(s,c,physical);c.validationMasterRegistry=s;core.save(s,root.localStorage,STORAGE_KEY);return{c,s};}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
function render(){const host=$('validationMasterRegistry');if(!host)return;const {c,s}=state();host.replaceChildren();
 const summary=document.createElement('p');summary.textContent='Registres: '+s.records.filter(r=>r.present!==false).length+' · esdeveniments: '+s.audit.length+' · persistència local i al projecte JSON';host.append(summary);
 const table=document.createElement('div');table.className='validation-registry-list';
 s.records.filter(r=>r.present!==false).forEach(r=>{const row=document.createElement('article');row.className='validation-entry '+String(r.status).toLowerCase().replaceAll('_','-');const title=document.createElement('strong');title.textContent=r.registryId+' · '+r.name+' · '+r.status;row.append(title);const meta=document.createElement('p');meta.textContent=r.type+' · ID font: '+r.sourceId+(r.levelName?' · '+r.levelName:'');row.append(meta);table.append(row);});host.append(table);
 const controls=document.createElement('div');controls.className='signal-controls';
 const act=document.createElement('button');act.type='button';act.textContent='Generar acta Markdown';act.addEventListener('click',()=>{const a=core.buildAct(s,c);download(a.id+'.md',a.markdown,'text/markdown;charset=utf-8');});controls.append(act);
 const json=document.createElement('button');json.type='button';json.textContent='Exportar registre JSON';json.addEventListener('click',()=>download('validation-master-registry.json',core.serialize(s),'application/json'));controls.append(json);
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Actualitzar registre';refresh.addEventListener('click',render);controls.append(refresh);host.append(controls);
 const note=document.createElement('label');note.textContent='Anotació de traçabilitat ';const input=document.createElement('input');input.type='text';input.placeholder='Nota de revisió / incidència';note.append(input);const add=document.createElement('button');add.type='button';add.textContent='Afegir nota';add.addEventListener('click',()=>{const id=s.records.find(r=>r.present!==false)?.registryId;if(!id){alert('No hi ha elements al registre.');return;}const result=core.appendNote(s,id,input.value);if(!result.ok)alert(result.error);else{core.save(s,root.localStorage,STORAGE_KEY);input.value='';render();}});note.append(add);host.append(note);
}
function install(){if(installed||!$('validationMasterRegistry'))return;installed=true;render();timer=setInterval(render,2500);}
root.JMRI_TC_VALIDATION_MASTER_REGISTRY_UI={refresh:render,stop(){if(timer)clearInterval(timer);timer=null;}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
