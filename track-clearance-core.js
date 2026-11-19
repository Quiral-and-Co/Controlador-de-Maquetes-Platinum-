(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.JMRI_TC_TRACK_CLEARANCE=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const EPS=1e-9;
  function finite(value,label){
    const n=Number(value);
    if(!Number.isFinite(n))throw new TypeError(label+' ha de ser finit.');
    return n;
  }
  function optionalFinite(value){
    if(value===undefined||value===null||value==='')return null;
    const n=Number(value);
    return Number.isFinite(n)?n:NaN;
  }
  function zProfile(piece,level){
    const vertical=piece.verticalGeometry;
    if(vertical){
      const start=optionalFinite(vertical.zStartMm),end=optionalFinite(vertical.zEndMm);
      if(start===null||end===null||Number.isNaN(start)||Number.isNaN(end))return {valid:false,start:NaN,end:NaN};
      return {valid:true,start,end};
    }
    const raw=Object.prototype.hasOwnProperty.call(piece,'zMm')?piece.zMm:level?.elevationMm;
    const z=optionalFinite(raw);
    return z===null||Number.isNaN(z)?{valid:false,start:NaN,end:NaN}:{valid:true,start:z,end:z};
  }
  function rotatePoint(piece,x,y,z){
    const a=finite(piece.rotation??0,'La rotació')*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    return {x:finite(piece.x,'La coordenada X')+x*c-y*s,y:finite(piece.y,'La coordenada Y')+x*s+y*c,zMm:z};
  }
  function sampleLine(piece,level,a,b,zp,step){
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    const count=Math.max(1,Math.ceil(length/step));
    const points=[];
    for(let i=0;i<=count;i++){
      const t=i/count;
      points.push(rotatePoint(piece,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,zp.start+(zp.end-zp.start)*t));
    }
    return points;
  }
  function sampleCurve(piece,zp,step){
    const g=piece.geometry||{},radius=finite(g.radiusMm,'El radi de la corba'),angle=finite(g.angleDeg,'L’angle de la corba');
    if(radius<=0||angle<=0||angle>=180)throw new RangeError('Geometria de corba fora de rang.');
    const sign=g.curveDirection==='left'?-1:1,rad=angle*Math.PI/180,arc=radius*rad,count=Math.max(2,Math.ceil(arc/step));
    const points=[];
    for(let i=0;i<=count;i++){
      const t=i/count,a=rad*t;
      points.push(rotatePoint(piece,radius*Math.sin(a),sign*radius*(1-Math.cos(a)),zp.start+(zp.end-zp.start)*t));
    }
    return points;
  }
  function piecePaths(piece,level,step){
    const g=piece.geometry||{},zp=zProfile(piece,level);
    if(!zp.valid)throw new Error('cota Z absent o invàlida');
    const type=piece.type;
    if(type==='straight'||type==='block'){
      const length=finite(g.lengthMm,'La longitud de la via');
      if(length<=0)throw new RangeError('La longitud ha de ser positiva.');
      return [{points:sampleLine(piece,level,{x:0,y:0},{x:length,y:0},zp,step),route:'principal'}];
    }
    if(type==='curve')return [{points:sampleCurve(piece,zp,step),route:'principal'}];
    if(type==='turnout'){
      if(piece.verticalGeometry)throw new Error('perfil Z de desviament no definit per branca');
      const length=finite(g.lengthMm,'La longitud del desviament'),offset=finite(g.branchOffsetMm??60,'El desplaçament de branca');
      if(length<=0||offset<=0)throw new RangeError('Geometria de desviament fora de rang.');
      const doubleSlip=piece.catalogueRef==='24624'||piece.junctionKind==='double-slip';
      const main=sampleLine(piece,level,{x:0,y:0},{x:length,y:doubleSlip?-offset:0},zp,step);
      if(doubleSlip){
        const crossing=sampleLine(piece,level,{x:0,y:-offset},{x:length,y:0},zp,step);
        return [{points:main,route:'A-B'},{points:crossing,route:'C-D'}];
      }
      const branch=sampleLine(piece,level,{x:0,y:0},{x:length*.83,y:-offset},zp,step);
      return [{points:main,route:'A-B'},{points:branch,route:'A-C'}];
    }
    throw new Error('tipus de peça sense geometria d’auditoria: '+String(type));
  }
  function bounds(points){
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
  }
  function bboxGap(a,b){
    const dx=Math.max(0,a.minX-b.maxX,b.minX-a.maxX),dy=Math.max(0,a.minY-b.maxY,b.minY-a.maxY);
    return Math.hypot(dx,dy);
  }
  function projectPoint(p,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
    const t=den<EPS?0:Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den));
    return {t,x:a.x+dx*t,y:a.y+dy*t};
  }
  function closest2D(a,b,c,d){
    const candidates=[];
    const cross=(u,v)=>u.x*v.y-u.y*v.x;
    const r={x:b.x-a.x,y:b.y-a.y},s={x:d.x-c.x,y:d.y-c.y},q={x:c.x-a.x,y:c.y-a.y},den=cross(r,s);
    if(Math.abs(den)>EPS){
      const t=cross(q,s)/den,u=cross(q,r)/den;
      if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS){
        const tt=Math.max(0,Math.min(1,t)),uu=Math.max(0,Math.min(1,u));
        return {t:tt,u:uu,distanceMm:0};
      }
    }
    for(const t of [0,1]){
      const p={x:a.x+r.x*t,y:a.y+r.y*t},q2=projectPoint(p,c,d);
      candidates.push({t,u:q2.t,distanceMm:Math.hypot(p.x-q2.x,p.y-q2.y)});
    }
    for(const u of [0,1]){
      const p={x:c.x+s.x*u,y:c.y+s.y*u},q2=projectPoint(p,a,b);
      candidates.push({t:q2.t,u,distanceMm:Math.hypot(p.x-q2.x,p.y-q2.y)});
    }
    candidates.sort((x,y)=>x.distanceMm-y.distanceMm);
    return candidates[0];
  }
  function candidateMetrics(a,b,t,u,c,d){
    const ax=a.x+(b.x-a.x)*t,ay=a.y+(b.y-a.y)*t,az=a.zMm+(b.zMm-a.zMm)*t;
    const bx=c.x+(d.x-c.x)*u,by=c.y+(d.y-c.y)*u,bz=c.zMm+(d.zMm-c.zMm)*u;
    return {horizontalMm:Math.hypot(ax-bx,ay-by),verticalMm:Math.abs(az-bz),zAMm:az,zBMm:bz,t,u};
  }
  function segmentMetrics(a,b,c,d,hLimit,vLimit){
    const candidates=[],near=closest2D(a,b,c,d);
    candidates.push(candidateMetrics(a,b,near.t,near.u,c,d));
    for(const t of [0,.5,1])for(const u of [0,.5,1])candidates.push(candidateMetrics(a,b,t,u,c,d));
    let minHorizontal=candidates[0],minVertical=candidates[0],conflict=null;
    for(const m of candidates){
      if(m.horizontalMm<minHorizontal.horizontalMm)minHorizontal=m;
      if(m.verticalMm<minVertical.verticalMm)minVertical=m;
      if(hLimit!==null&&vLimit!==null&&m.horizontalMm<=hLimit+EPS&&m.verticalMm<=vLimit+EPS){
        const score=(hLimit===0?(m.horizontalMm<=EPS?0:Infinity):m.horizontalMm/hLimit)+(vLimit===0?(m.verticalMm<=EPS?0:Infinity):m.verticalMm/vLimit);
        if(!conflict||score<conflict.score)conflict={...m,score};
      }
    }
    return {minHorizontalMm:minHorizontal.horizontalMm,verticalAtMinHorizontalMm:minHorizontal.verticalMm,minVerticalMm:minVertical.verticalMm,horizontalAtMinVerticalMm:minVertical.horizontalMm,conflict};
  }
  function connectedPairSet(connections){
    const out=new Set();
    for(const c of connections||[]){
      const a=c?.from?.pieceId,b=c?.to?.pieceId;
      if(!a||!b||a===b)continue;
      out.add([String(a),String(b)].sort().join('|'));
    }
    return out;
  }
  function audit(layout,profile={},options={}){
    if(!layout||!Array.isArray(layout.levels))throw new TypeError('El projecte ha de contenir nivells.');
    const step=finite(options.samplingStepMm??5,'El pas de mostreig');
    const tolerance=finite(options.projectedToleranceMm??1,'La tolerància de projecció');
    if(step<=0||tolerance<0)throw new RangeError('El pas ha de ser positiu i la tolerància no negativa.');
    const hRaw=optionalFinite(profile.horizontalAxisMm),vRaw=optionalFinite(profile.verticalAxisMm);
    const hLimit=hRaw===null?null:hRaw,vLimit=vRaw===null?null:vRaw;
    if(Number.isNaN(hLimit)||Number.isNaN(vLimit)||(hLimit!==null&&hLimit<0)||(vLimit!==null&&vLimit<0))throw new RangeError('Els llindars de separació han de ser nombres no negatius.');
    const thresholdsConfigured=hLimit!==null&&vLimit!==null,searchDistance=hLimit===null?tolerance:Math.max(tolerance,hLimit);
    const connected=connectedPairSet(layout.connections),paths=[],unsupported=[],pieces=[];
    for(const level of layout.levels){
      for(const piece of level.tracks||[]){
        pieces.push({piece,level});
        try{
          const routes=piecePaths(piece,level,step);
          for(let i=0;i<routes.length;i++){
            const route=routes[i];
            paths.push({pieceId:String(piece.id),pieceName:piece.name||String(piece.id),type:piece.type,levelId:String(level.id),levelName:level.name||String(level.id),route:route.route,points:route.points,bounds:bounds(route.points),geometryConfirmed:piece.geometryStatus==='confirmed'});
          }
          if(piece.geometryStatus!=='confirmed')unsupported.push({pieceId:String(piece.id),levelId:String(level.id),reason:'geometria provisional o sense confirmació de catàleg'});
        }catch(error){unsupported.push({pieceId:String(piece.id),levelId:String(level.id),reason:error.message});}
      }
    }
    const findings=[],projectedCrossings=[];let routePairsChecked=0;
    for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){
      const a=paths[i],b=paths[j];
      if(a.pieceId===b.pieceId)continue;
      if(connected.has([a.pieceId,b.pieceId].sort().join('|')))continue;
      if(bboxGap(a.bounds,b.bounds)>searchDistance)continue;
      routePairsChecked++;
      let bestHorizontal=null,bestVertical=null,conflict=null;
      for(let ai=0;ai<a.points.length-1;ai++)for(let bi=0;bi<b.points.length-1;bi++){
        const sa=a.points[ai],sb=a.points[ai+1],sc=b.points[bi],sd=b.points[bi+1];
        const segBoundsA={minX:Math.min(sa.x,sb.x),maxX:Math.max(sa.x,sb.x),minY:Math.min(sa.y,sb.y),maxY:Math.max(sa.y,sb.y)};
        const segBoundsB={minX:Math.min(sc.x,sd.x),maxX:Math.max(sc.x,sd.x),minY:Math.min(sc.y,sd.y),maxY:Math.max(sc.y,sd.y)};
        if(bboxGap(segBoundsA,segBoundsB)>searchDistance)continue;
        const m=segmentMetrics(sa,sb,sc,sd,hLimit,vLimit);
        if(!bestHorizontal||m.minHorizontalMm<bestHorizontal.minHorizontalMm)bestHorizontal={...m,a:sa,b:sb,c:sc,d:sd};
        if(!bestVertical||m.minVerticalMm<bestVertical.minVerticalMm)bestVertical={...m,a:sa,b:sb,c:sc,d:sd};
        if(m.conflict&&(!conflict||m.conflict.score<conflict.score))conflict={...m.conflict};
      }
      if(!bestHorizontal)continue;
      const item={pieceA:a.pieceId,pieceB:b.pieceId,levelA:a.levelName,levelB:b.levelName,levelIdA:a.levelId,levelIdB:b.levelId,routeA:a.route,routeB:b.route,
        horizontalMm:bestHorizontal.minHorizontalMm,verticalAtHorizontalMm:bestHorizontal.verticalAtMinHorizontalMm,
        minVerticalMm:bestVertical.minVerticalMm,horizontalAtVerticalMm:bestVertical.horizontalAtMinVerticalMm,
        zAMm:conflict?.zAMm??null,zBMm:conflict?.zBMm??null,geometryConfirmed:a.geometryConfirmed&&b.geometryConfirmed};
      if(item.horizontalMm<=tolerance+EPS)projectedCrossings.push(item);
      if(conflict){
        const finding={...item,horizontalMm:conflict.horizontalMm,verticalMm:conflict.verticalMm,zAMm:conflict.zAMm,zBMm:conflict.zBMm};
        if(finding.geometryConfirmed)findings.push({...finding,status:'CONFLICT'});
        else findings.push({...finding,status:'POTENTIAL_CONFLICT'});
      }
    }
    findings.sort((a,b)=>(a.status==='CONFLICT'?0:1)-(b.status==='CONFLICT'?0:1)||a.horizontalMm-b.horizontalMm||a.verticalMm-b.verticalMm);
    const complete=unsupported.length===0&&paths.length>0;
    let status;
    if(pieces.length===0)status='EMPTY';
    else if(!thresholdsConfigured)status='UNCONFIGURED';
    else if(findings.some(x=>x.status==='CONFLICT'))status='CONFLICT';
    else if(findings.length)status='POTENTIAL_CONFLICT';
    else if(!complete)status='INCOMPLETE';
    else status='WITHIN_THRESHOLDS_UNVERIFIED';
    return Object.freeze({status,thresholdsConfigured,horizontalAxisMm:hLimit,verticalAxisMm:vLimit,paths:paths.length,routePairsChecked,findings,projectedCrossings,unsupported,geometryComplete:complete,
      note:'Comparació geomètrica aproximada d’eixos; no certifica gàlibs de material mòbil, estructures, pantògrafs, cablejat ni seguretat física.'});
  }
  return Object.freeze({audit,piecePaths,zProfile,closest2D,segmentMetrics});
});