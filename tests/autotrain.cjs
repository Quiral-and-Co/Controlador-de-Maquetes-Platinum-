'use strict';
const assert=require('node:assert/strict');
const core=require('../autotrain-core.js');
const routes=[
 {id:'r1',blockIds:['A','B','C'],turnoutRequirements:[]},
 {id:'r2',blockIds:['C','D'],turnoutRequirements:[]}
];
assert.deepEqual(core.shortestPath(routes,'A','D').blockIds,['A','B','C','D']);
assert.equal(core.shortestPath(routes,'A','Z').ok,false);
assert.equal(core.shortestPath(routes,'A','A').ok,false);
const snapshot={
 blocks:['A','B','C'].map(id=>({id,verified:true,sensorIds:['S-'+id]})),
 blockStates:{A:'OCCUPIED',B:'FREE',C:'FREE},
 reservations:{}
};
const valid={blockIds:['A','B','C'],snapshot,locomotiveId:'L1',speedProfileVerified:true,sourceConfirmed:true};
assert.equal(core.validatePlan(valid).ok,true);
assert.match(core.validatePlan({...valid,snapshot:{...snapshot,blockStates:{...snapshot.blockStates,B:'UNKNOWN'}}}).error,/B/);
assert.match(core.validatePlan({...valid,editMode:true}).error,/edició/);
assert.match(core.validatePlan({...valid,snapshot:{...snapshot,blocks:snapshot.blocks.map(b=>b.id==='B'?{...b,verified:false}:b)}}).error,/B/);
assert.match(core.validatePlan({...valid,snapshot:{...snapshot,reservations:{B:'other'}}}).error,/reservat/);
assert.match(core.validatePlan({...valid,speedProfileVerified:false}).error,/perfil de velocitat/);
assert.match(core.validatePlan({...valid,sourceConfirmed:false}).error,/bloc d’origen/);
const conflict=core.shortestPath([
 {id:'x',blockIds:['A','B'],turnoutRequirements:[{systemName:'T1',requiredState:'CLOSED'}]},
 {id:'y',blockIds:['B','C'],turnoutRequirements:[{systemName:'T1',requiredState:'THROWN'}]}
],'A','C');
assert.equal(conflict.ok,false);
console.log('AutoTrain core: proves superades.');
