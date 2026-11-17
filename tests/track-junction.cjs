'use strict';
const assert=require('node:assert/strict');
const junction=require('../track-junction-core.js');
assert.deepEqual(junction.curvePorts(360,30,'right'),[
 {x:0,y:0,port:'A'},
 {x:179.99999999999997,y:24.11542731880104,port:'B'}
]);
const left=junction.curvePorts(360,30,'left');
assert.ok(left[1].y<0,'La corba esquerra ha de sortir en Y negativa.');
assert.equal(junction.turnoutPorts(188.3,60,'normal').length,3);
assert.deepEqual(junction.turnoutPorts(188.3,60,'double-slip').map(p=>p.port),['A','B','C','D']);
assert.equal(junction.preferredPort({type:'turnout',connectionPoint:'C'}),'C');
assert.equal(junction.preferredPort({type:'turnout',catalogueRef:'24624',connectionPoint:'D'}),'D');
const cat=[
 {ref:'24077',type:'straight',lengthMm:77.5,geometryStatus:'confirmed'},
 {ref:'24094',type:'straight',lengthMm:94.2,geometryStatus:'confirmed'},
 {ref:'24188',type:'straight',lengthMm:188.3,geometryStatus:'confirmed'}
];
const gaps=junction.recommendGaps([
 {pieceId:'A',levelId:1,x:0,y:0},
 {pieceId:'B',levelId:1,x:188.3,y:0},
 {pieceId:'C',levelId:1,x:0,y:100}
],cat,300);
assert.equal(gaps.length,1);
assert.equal(gaps[0].candidates[0].totalLengthMm,188.3);
assert.deepEqual(gaps[0].candidates[0].refs,['24188']);
assert.throws(()=>junction.curvePorts(0,30,'right'),/invàlida/);
console.log('PASS track junction geometry, connection choices and catalogue gap recommendations');
