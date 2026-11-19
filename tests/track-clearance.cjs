'use strict';
const assert=require('node:assert/strict');
const clearance=require('../track-clearance-core.js');
function layout(pieces,connections=[]){
  return {schemaVersion:3,room:{widthMm:3000,heightMm:1800},levels:[
    {id:1,name:'Nivell 1',elevationMm:0,tracks:pieces.filter(x=>x.levelId===1),blocks:[],sensors:[]},
    {id:2,name:'Nivell 2',elevationMm:110,tracks:pieces.filter(x=>x.levelId===2),blocks:[],sensors:[]}
  ],connections};
}
function piece(id,levelId,x,y,rotation,zMm,extra={}){
  return {id,name:id,type:'straight',x,y,rotation,levelId,zMm,geometry:{lengthMm:100},geometryStatus:'confirmed',...extra};
}
const thresholds={horizontalAxisMm:20,verticalAxisMm:80};

// A plan-view crossing with insufficient vertical axis separation is a conflict.
let project=layout([
  piece('LOW',1,100,100,0,0),
  piece('HIGH',2,150,50,90,50)
]);
let result=clearance.audit(project,thresholds);
assert.equal(result.status,'CONFLICT');
assert.equal(result.findings.length,1);
assert.equal(result.findings[0].status,'CONFLICT');
assert.ok(result.findings[0].horizontalMm<0.01);
assert.equal(result.findings[0].verticalMm,50);

// 110 mm planned level separation is reported as geometry, not treated as a default safety threshold.
project=layout([
  piece('LOW',1,100,100,0,0),
  piece('HIGH',2,150,50,90,110)
]);
result=clearance.audit(project,{horizontalAxisMm:20,verticalAxisMm:100});
assert.equal(result.status,'WITHIN_THRESHOLDS_UNVERIFIED');
assert.equal(result.findings.length,0);
assert.equal(result.projectedCrossings.length,1);

// A ramp's Z varies along the piece; the crossing at its midpoint must be detected.
project=layout([
  piece('RAMP',1,100,100,0,0,{verticalGeometry:{zStartMm:0,zEndMm:110}}),
  piece('CROSS',2,150,50,90,55)
]);
result=clearance.audit(project,thresholds);
assert.equal(result.status,'CONFLICT');
assert.ok(result.findings[0].verticalMm<1);

// Close parallel axes are a conflict when both horizontal and vertical thresholds are exceeded.
project=layout([
  piece('A',1,100,100,0,0),
  piece('B',2,100,115,0,20)
]);
result=clearance.audit(project,{horizontalAxisMm:20,verticalAxisMm:30});
assert.equal(result.status,'CONFLICT');
assert.ok(result.findings[0].horizontalMm<=20);
assert.ok(result.findings[0].verticalMm<=30);

// If the thresholds are absent, the tool only reports projected intersections and never declares clearance.
project=layout([
  piece('A',1,100,100,0,0),
  piece('B',2,150,50,90,110)
]);
result=clearance.audit(project,{});
assert.equal(result.status,'UNCONFIGURED');
assert.equal(result.findings.length,0);
assert.equal(result.projectedCrossings.length,1);

// Geometry without catalogue confirmation may produce a potential conflict, never a verified one.
project=layout([
  piece('A',1,100,100,0,0,{geometryStatus:'provisional'}),
  piece('B',2,150,50,90,0)
]);
result=clearance.audit(project,thresholds);
assert.equal(result.status,'POTENTIAL_CONFLICT');
assert.equal(result.findings[0].status,'POTENTIAL_CONFLICT');

// Explicitly connected neighboring pieces are not treated as an interference.
project=layout([
  piece('A',1,100,100,0,0),
  piece('B',1,200,100,0,0)
],[{id:'C1',levelId:1,from:{pieceId:'A',port:'B'},to:{pieceId:'B',port:'A'},verified:false}]);
result=clearance.audit(project,thresholds);
assert.equal(result.status,'WITHIN_THRESHOLDS_UNVERIFIED');
assert.equal(result.routePairsChecked,0);

// Curves are sampled along their arc and can be checked against another level.
project=layout([
  {id:'CURVE',name:'CURVE',type:'curve',x:100,y:100,rotation:0,levelId:1,zMm:0,geometry:{radiusMm:100,angleDeg:90,curveDirection:'right'},geometryStatus:'confirmed'},
  piece('CROSS',2,120,129.289321881,0,0)
]);
result=clearance.audit(project,{horizontalAxisMm:5,verticalAxisMm:5});
assert.ok(result.paths>=2);
assert.ok(result.findings.length>=1);

// Unsupported geometry fails closed; the audit cannot return a within-threshold result.
project=layout([{id:'S',name:'S',type:'special',x:0,y:0,rotation:0,levelId:1,zMm:0,geometry:{}}]);
result=clearance.audit(project,thresholds);
assert.equal(result.status,'INCOMPLETE');
assert.equal(result.unsupported.length,1);

assert.throws(()=>clearance.audit(layout([]),{horizontalAxisMm:-1,verticalAxisMm:20}),/no negatius/);
assert.equal(clearance.audit(layout([]),{}).status,'EMPTY');
console.log('PASS 3D clearance: crossings, vertical profiles, axis thresholds, unconfigured limits, provisional geometry, connected pieces, curves and fail-closed unsupported pieces');