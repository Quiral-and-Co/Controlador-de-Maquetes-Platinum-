(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.JMRI_TC_TRACK_JUNCTION=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function finite(v,label){const n=Number(v);if(!Number.isFinite(n))throw new TypeError(label+' ha de ser finit.');return n;}
  function curvePorts(radius,angleDeg,direction){
    const r=finite(radius,'El radi'),a=finite(angleDeg,'L’angle')*Math.PI/180;
    if(r<=0||angleDeg<=0||angleDeg>=180)throw new RangeError('Geometria de corba invàlida.');
    const sign=direction==='left'?-1:1;
    return [{x:0,y:0,port:'A'},{x:r*Math.sin(a),y:sign*r*(1-Math.cos(a)),port:'B'}];
  }
  function turnoutPorts(length,branchOffset,kind){
    const len=finite(length,'La longitud'),off=finite(branchOffset,'El desplaçament de branca');
    if(len<=0||off<=0)throw new RangeError('Geometria de desviament invàlida.');
    if(kind==='double-slip')return [
      {x:0,y:0,port:'A'},{x:len,y:-off,port:'B'},
      {x:0,y:-off,port:'C'},{x:len,y:0,port:'D'}
    ];
    return [{x:0,y:0,port:'A'},{x:len,y:0,port:'B'},{x:len*.83,y:-off,port:'C'}];
  }
  function preferredPort(piece){
    const mode=piece&&piece.connectionPoint;
    if(piece&&piece.type==='turnout'&&(piece.catalogueRef==='24624'||piece.junctionKind==='double-slip')){
      return ['A','B','C','D'].includes(mode)?mode:'A';
    }
    if(piece&&piece.type==='turnout')return ['A','B','C'].includes(mode)?mode:'A';
    return null;
  }
  function recommendGaps(openPorts,catalogue,maxGap){
    const limit=maxGap===undefined?500:finite(maxGap,'La distància màxima');
    const straights=(catalogue||[]).filter(x=>x.type==='straight'&&x.geometryStatus==='confirmed'&&Number(x.lengthMm)>0)
      .sort((a,b)=>Number(a.lengthMm)-Number(b.lengthMm));
    const combos=[];
    for(let i=0;i<straights.length;i++)for(let j=i;j<straights.length;j++)for(let k=j;k<straights.length;k++){
      const items=[straights[i],straights[j],straights[k]];
      combos.push({items,totalLengthMm:items.reduce((n,x)=>n+Number(x.lengthMm),0),refs:items.map(x=>x.ref)});
    }
    const results=[];
    for(let i=0;i<openPorts.length;i++)for(let j=i+1;j<openPorts.length;j++){
      const a=openPorts[i],b=openPorts[j];
      if(a.pieceId===b.pieceId||String(a.levelId)!==String(b.levelId))continue;
      const distance=Math.hypot(b.x-a.x,b.y-a.y);
      if(distance<40||distance>limit)continue;
      const candidates=combos.map(c=>({...c,errorMm:Math.abs(c.totalLengthMm-distance)}))
        .filter(c=>c.errorMm<=2)
        .sort((x,y)=>x.errorMm-y.errorMm||x.items.length-y.items.length)
        .slice(0,3);
      if(candidates.length)results.push({from:a,to:b,distanceMm:distance,candidates});
    }
    return results.sort((a,b)=>a.distanceMm-b.distanceMm);
  }
  return Object.freeze({curvePorts,turnoutPorts,preferredPort,recommendGaps});
});
