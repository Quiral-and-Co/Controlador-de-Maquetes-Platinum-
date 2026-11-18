'use strict';
const assert=require('node:assert/strict');
const edit=require('../edit-commands-core');
const fixture=()=>({levels:[
 {id:1,elevationMm:0,tracks:[
  {id:'A',type:'straight',name:'Via A',x:100,y:100,rotation:0},
  {id:'B',type:'straight',name:'Via B',x:280,y:100,rotation:0},
  {id:'C',type:'curve',name:'Via C',x:500,y:100,rotation:0}],blocks:[],sensors:[]},
 {id:2,elevationMm:110,tracks:[{id:'OTHER',type:'straight',x:20,y:20}],blocks:[],sensors:[]}
],connections:[
 {id:'AB',levelId:1,from:{pieceId:'A',port:'B'},to:{pieceId:'B',port:'A'},verified:true},
 {id:'BC',levelId:1,from:{pieceId:'B',port:'B'},to:{pieceId:'C',port:'A'},verified:false}
]});
{
 const config=fixture(),clipboard=edit.copySelection(config,1,['A','B']);
 assert.deepEqual(clipboard.elements.map(p=>p.id),['A','B']);
 assert.deepEqual(clipboard.connections.map(c=>c.id),['AB']);
 assert.equal(config.levels[0].tracks.length,3,'copy must not mutate source');
}
{
 const config=fixture(),result=edit.cutSelection(config,1,['A','B']);
 assert.equal(result.changed,true);
 assert.deepEqual(result.removedIds,['A','B']);
 assert.deepEqual(result.config.levels[0].tracks.map(p=>p.id),['C']);
 assert.deepEqual(result.config.connections,[]);
 assert.equal(result.clipboard.connections.length,1,'cut clipboard must preserve internal connection');
 assert.equal(config.levels[0].tracks.length,3,'cut must not mutate source');
}
{
 const config=fixture(),clipboard=edit.copySelection(config,1,['A','B']);
 const result=edit.pasteClipboard(config,2,clipboard,{offset:40,width:3000,height:1800,createId:(_p,i)=>'NEW-'+i});
 assert.deepEqual(result.addedIds,['NEW-0','NEW-1']);
 assert.equal(result.config.levels[1].tracks.length,3);
 assert.equal(result.config.levels[1].tracks[1].x,140);
 assert.equal(result.config.levels[1].tracks[2].x,320);
 assert.equal(result.config.levels[1].tracks[1].zMm,110);
 assert.equal(result.config.connections.length,3);
 const pasted=result.config.connections[2];
 assert.equal(pasted.from.pieceId,'NEW-0');
 assert.equal(pasted.to.pieceId,'NEW-1');
 assert.equal(pasted.verified,false,'copied connection must never inherit electrical verification');
 assert.equal(config.levels[1].tracks.length,1,'paste must not mutate source');
}
{
 const config=fixture();
 assert.deepEqual(edit.selectAll(config,1),['A','B','C']);
 assert.equal(edit.cutSelection(config,1,[]).changed,false);
 assert.equal(edit.pasteClipboard(config,1,{version:1,elements:[],connections:[]}).changed,false);
}
{
 const config=fixture(),result=edit.removeSelection(config,1,['A']);
 assert.equal(result.changed,true);
 assert.deepEqual(result.config.connections.map(c=>c.id),[]);
 assert.deepEqual(result.config.levels[0].tracks.map(p=>p.id),['B','C']);
}
console.log('PASS Edit core: multi-selection copy/cut, internal connection preservation, cross-level paste, unique remapping, safe verification reset, delete and select-all');
