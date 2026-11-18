(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.JMRI_TC_TRACK_TOPOLOGY_3D=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  function optionalFinite(value){
    if(value===undefined||value===null||value==='')return null;
    const number=Number(value);
    return Number.isFinite(number)?number:NaN;
  }

  function portZ(piece,level,port){
    if(!piece||!level)return NaN;
    const vertical=piece.verticalGeometry;
    if(vertical){
      const key=port==='A'?'zStartMm':port==='B'?'zEndMm':null;
      if(key&&Object.prototype.hasOwnProperty.call(vertical,key)){
        const value=optionalFinite(vertical[key]);
        return value===null?NaN:value;
      }
    }
    if(Object.prototype.hasOwnProperty.call(piece,'zMm')){
      const value=optionalFinite(piece.zMm);
      return value===null?NaN:value;
    }
    const elevation=optionalFinite(level.elevationMm);
    return elevation===null?NaN:elevation;
  }

  function gap3D(a,b){
    const ax=optionalFinite(a&&a.x),ay=optionalFinite(a&&a.y),az=optionalFinite(a&&a.zMm);
    const bx=optionalFinite(b&&b.x),by=optionalFinite(b&&b.y),bz=optionalFinite(b&&b.zMm);
    if([ax,ay,az,bx,by,bz].some(value=>value===null||Number.isNaN(value)))
      return {valid:false,distanceMm:NaN,horizontalMm:NaN,verticalMm:NaN};
    const dx=ax-bx,dy=ay-by,dz=az-bz;
    return {valid:true,distanceMm:Math.hypot(dx,dy,dz),horizontalMm:Math.hypot(dx,dy),verticalMm:Math.abs(dz),deltaZMm:dz};
  }

  return Object.freeze({portZ,gap3D});
});
