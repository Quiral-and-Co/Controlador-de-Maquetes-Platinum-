'use strict';
const { unzipSync } = require('fflate');
const initSqlJs = require('sql.js');
const path = require('node:path');
let SQLPromise;
function sqlEngine(){if(!SQLPromise)SQLPromise=initSqlJs({locateFile:file=>path.join(path.dirname(require.resolve('sql.js')),file)});return SQLPromise;}
function rows(db,sql){const result=db.exec(sql);if(!result.length)return[];const {columns,values}=result[0];return values.map(row=>Object.fromEntries(columns.map((column,index)=>[column,row[index]])));}
function imageData(entries,name){
  const target=String(name||'').replace(/\\/g,'/').split('/').pop().toLowerCase();if(!target)return'';
  const entry=Object.entries(entries).find(([file,data])=>!data.directory&&file.replace(/\\/g,'/').split('/').pop().toLowerCase()===target);
  if(!entry)return'';
  const [file,data]=entry;if(data.length>3*1024*1024)return'';
  const ext=path.extname(file).toLowerCase(),mime=({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml'})[ext];
  return mime?'data:'+mime+';base64,'+Buffer.from(data).toString('base64'):'';
}
async function importZ21Archive(bytes){
  const entries=unzipSync(new Uint8Array(bytes));
  const dbEntry=Object.entries(entries).find(([name,data])=>!data.directory&&name.toLowerCase().endsWith('.sqlite'));
  if(!dbEntry)throw new Error('L’exportació .z21 no conté cap base de dades SQLite.');
  const SQL=await sqlEngine(),database=new SQL.Database(dbEntry[1]);
  try{
    const vehicles=rows(database,'SELECT * FROM vehicles'),functions=rows(database,'SELECT * FROM functions');
    if(!vehicles.length)throw new Error('La base de dades Z21 no conté vehicles.');
    let imageBytes=0;
    const result=vehicles.map(vehicle=>{
      const kind=Number(vehicle.type)===0?'locomotive':Number(vehicle.type)===1?'car':'car';
      const functionRows=functions.filter(fn=>Number(fn.vehicle_id)===Number(vehicle.id)&&Number(fn.is_configured??1)===1&&String(fn.shortcut||fn.image_name||'')!=='Empty');
      const mappedFunctions=functionRows.map(fn=>({number:Number(fn.function),label:String(fn.shortcut||fn.image_name||('F'+fn.function)),icon:imageData(entries,fn.image_name)||String(fn.image_name||'circle'),momentary:Number(fn.button_type)===1,buttonType:Number(fn.button_type),durationMs:Number(fn.time)||0,description:String(fn.shortcut||''),position:Number(fn.position)||0,showNumber:Number(fn.show_function_number)===1}));
      const image=imageData(entries,vehicle.image_name);if(image)imageBytes+=Math.floor(image.length*3/4);
      return{id:'Z21-'+String(vehicle.id),name:String(vehicle.name||vehicle.full_name||('Vehicle '+vehicle.id)),kind,manufacturer:'ROCO/FLEISCHMANN',model:String(vehicle.full_name||''),article:'',protocol:'DCC',address:String(vehicle.address??''),addressType:'auto',decoder:'',maxKmh:Number(vehicle.max_speed)||null,image,drawing:'',functions:mappedFunctions,cv:{},source:'ROCO_Z21_EXPORT',sourceId:String(vehicle.id),identity:'Z21:'+String(vehicle.address??vehicle.id),metadata:{imageName:String(vehicle.image_name||''),railway:String(vehicle.railway||''),description:String(vehicle.description||''),speedDisplay:Number(vehicle.speed_display)||128,regulationStep:Number(vehicle.speed_display)||128,tractionDirection:Number(vehicle.traction_direction)||0,dummy:Number(vehicle.dummy)||0,active:Number(vehicle.active)||0,position:Number(vehicle.position)||0}};
    });
    if(imageBytes>25*1024*1024)throw new Error('Les imatges de l’exportació superen el límit de 25 MB.');
    return{ok:true,source:'ROCO_Z21_EXPORT',vehicles:result,counts:{vehicles:result.length,functions:result.reduce((sum,v)=>sum+v.functions.length,0),images:result.filter(v=>v.image).length}};
  }finally{database.close();}
}
module.exports={importZ21Archive};
