'use strict';
(function(root){
  const clone=value=>JSON.parse(JSON.stringify(value));
  function levelFor(config,levelId){return (config?.levels||[]).find(level=>String(level.id)===String(levelId));}
  function copySelection(config,levelId,selectedIds){
    const level=levelFor(config,levelId);
    if(!level)return {version:1,sourceLevelId:levelId,elements:[],connections:[]};
    const ids=new Set((selectedIds||[]).map(String));
    const elements=(level.tracks||[]).filter(piece=>ids.has(String(piece.id))).map(clone);
    const copiedIds=new Set(elements.map(piece=>String(piece.id)));
    const connections=(config.connections||[]).filter(connection=>
      String(connection.levelId??levelId)===String(levelId)&&
      copiedIds.has(String(connection.from?.pieceId))&&copiedIds.has(String(connection.to?.pieceId))
    ).map(clone);
    return {version:1,sourceLevelId:levelId,elements,connections};
  }
  function removeSelection(config,levelId,selectedIds){
    const next=clone(config),level=levelFor(next,levelId),ids=new Set((selectedIds||[]).map(String));
    if(!level||!ids.size)return {config:next,removedIds:[],changed:false};
    const removedIds=(level.tracks||[]).filter(piece=>ids.has(String(piece.id))).map(piece=>String(piece.id));
    level.tracks=(level.tracks||[]).filter(piece=>!ids.has(String(piece.id)));
    if(!removedIds.length)return {config:next,removedIds:[],changed:false};
    const removed=new Set(removedIds);
    next.connections=(next.connections||[]).filter(connection=>
      !removed.has(String(connection.from?.pieceId))&&!removed.has(String(connection.to?.pieceId))
    );
    return {config:next,removedIds,changed:true};
  }
  function cutSelection(config,levelId,selectedIds){
    const clipboard=copySelection(config,levelId,selectedIds);
    if(!clipboard.elements.length)return {config:clone(config),clipboard:null,removedIds:[],changed:false};
    const result=removeSelection(config,levelId,clipboard.elements.map(piece=>piece.id));
    return {...result,clipboard};
  }
  function pasteClipboard(config,levelId,clipboard,options={}){
    const next=clone(config),level=levelFor(next,levelId);
    if(!level)throw new Error('No existeix el nivell de destinació.');
    if(!clipboard||clipboard.version!==1||!Array.isArray(clipboard.elements)||!clipboard.elements.length)
      return {config:next,addedIds:[],connectionIds:[],changed:false};
    const grid=Math.max(1,Number(options.grid)||10),offset=Number.isFinite(Number(options.offset))?Number(options.offset):40;
    const width=Math.max(0,Number(options.width)||3000),height=Math.max(0,Number(options.height)||1800);
    const snap=value=>Math.round(value/grid)*grid;
    const existing=new Set((next.levels||[]).flatMap(item=>(item.tracks||[]).map(piece=>String(piece.id))));
    let sequence=0;
    const makeId=typeof options.createId==='function'?options.createId:()=> 'EDIT-'+Date.now().toString(36)+'-'+(++sequence).toString(36);
    const idMap=new Map();
    const added=clipboard.elements.map((source,index)=>{
      let id=String(makeId(source,index));
      while(!id||existing.has(id))id=String(makeId(source,index)+'-'+(++sequence));
      existing.add(id);idMap.set(String(source.id),id);
      const x=Number(source.x)||0,y=Number(source.y)||0;
      return {...clone(source),id,name:(source.name||source.type||'Element')+' (còpia)',
        x:snap(Math.max(0,Math.min(width,x+offset))),y:snap(Math.max(0,Math.min(height,y+offset))),
        levelId:level.id,zMm:Number(level.elevationMm)||0};
    });
    level.tracks=level.tracks||[];
    level.tracks.push(...added);
    next.connections=next.connections||[];
    const connectionIds=[];
    for(const source of clipboard.connections||[]){
      const from=idMap.get(String(source.from?.pieceId)),to=idMap.get(String(source.to?.pieceId));
      if(!from||!to)continue;
      let id='EDIT-C-'+Date.now().toString(36)+'-'+(++sequence).toString(36);
      while(next.connections.some(connection=>String(connection.id)===id))id+='-x';
      next.connections.push({...clone(source),id,levelId:level.id,
        from:{...clone(source.from),pieceId:from},to:{...clone(source.to),pieceId:to},verified:false});
      connectionIds.push(id);
    }
    return {config:next,addedIds:added.map(piece=>piece.id),connectionIds,changed:true};
  }
  function selectAll(config,levelId){
    const level=levelFor(config,levelId);
    return (level?.tracks||[]).map(piece=>piece.id);
  }
  const api={copySelection,removeSelection,cutSelection,pasteClipboard,selectAll};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.JMRI_TC_EDIT_COMMANDS=api;
})(typeof window!=='undefined'?window:globalThis);
