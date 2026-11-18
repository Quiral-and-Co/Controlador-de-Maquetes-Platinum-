'use strict';
(function(root){
  const TYPES=Object.freeze(['PASSENGER','FREIGHT','LOCOMOTIVE']);
  function ensure(roster){
    const value=roster&&typeof roster==='object'?roster:{};
    value.cars=Array.isArray(value.cars)?value.cars:[];
    value.trainSets=Array.isArray(value.trainSets)?value.trainSets:[];
    value.trains=Array.isArray(value.trains)?value.trains:[];
    value.speedProfiles=value.speedProfiles&&typeof value.speedProfiles==='object'?value.speedProfiles:{};
    return value;
  }
  function cleanName(value){const name=String(value||'').trim();if(!name||name.length>80)throw new Error('El nom ha de tenir entre 1 i 80 caràcters.');return name;}
  function makeId(prefix,items){let n=1,id;const ids=new Set(items.map(x=>x.id));do{id=prefix+'-'+String(n++).padStart(4,'0');}while(ids.has(id));return id;}
  function addCar(roster,input={}){
    const r=ensure(roster);let name;try{name=cleanName(input.name);}catch(error){return{ok:false,error:error.message};}
    const type=String(input.type||'PASSENGER').toUpperCase();if(!TYPES.includes(type)||type==='LOCOMOTIVE')return{ok:false,error:'Tipus de vagó no vàlid.'};
    const lengthMm=Number(input.lengthMm??200);if(!Number.isFinite(lengthMm)||lengthMm<20||lengthMm>2000)return{ok:false,error:'La longitud ha d’estar entre 20 i 2000 mm.'};
    if(r.cars.some(x=>x.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return{ok:false,error:'Ja existeix un vagó amb aquest nom.'};
    const car={id:makeId('CAR',r.cars),name,type,lengthMm,trainId:null,trainSetId:null};r.cars.push(car);return{ok:true,car};
  }
  function addTrainSet(roster,input={}){
    const r=ensure(roster);let name;try{name=cleanName(input.name);}catch(error){return{ok:false,error:error.message};}
    if(r.trainSets.some(x=>x.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return{ok:false,error:'Ja existeix una composició fixa amb aquest nom.'};
    const set={id:makeId('SET',r.trainSets),name,carIds:[],notes:String(input.notes||'')};r.trainSets.push(set);return{ok:true,trainSet:set};
  }
  function addTrain(roster,input={}){
    const r=ensure(roster);let name;try{name=cleanName(input.name);}catch(error){return{ok:false,error:error.message};}
    if(r.trains.some(x=>x.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return{ok:false,error:'Ja existeix un tren amb aquest nom.'};
    const train={id:makeId('TRAIN',r.trains),name,engineId:String(input.engineId||''),carIds:[],trainSetId:String(input.trainSetId||''),status:'PARKED'};r.trains.push(train);return{ok:true,train};
  }
  function couple(roster,trainId,carId){
    const r=ensure(roster),train=r.trains.find(x=>x.id===trainId),car=r.cars.find(x=>x.id===carId);
    if(!train||!car)return{ok:false,error:'No s’ha trobat el tren o el vagó.'};
    if(car.trainSetId)return{ok:false,error:'Retira el vagó de la composició fixa abans d’acoblar-lo directament a un tren.'};
    if(car.trainId&&car.trainId!==train.id)return{ok:false,error:'El vagó ja està acoblat a un altre tren.'};
    if(train.carIds.includes(car.id))return{ok:false,error:'El vagó ja forma part d’aquest tren.'};
    train.carIds.push(car.id);car.trainId=train.id;return{ok:true,train,car};
  }
  function uncouple(roster,trainId,carId){
    const r=ensure(roster),train=r.trains.find(x=>x.id===trainId),car=r.cars.find(x=>x.id===carId);
    if(!train||!car||!train.carIds.includes(car.id)||car.trainId!==train.id)return{ok:false,error:'El vagó no està acoblat a aquest tren.'};
    train.carIds=train.carIds.filter(id=>id!==car.id);car.trainId=null;return{ok:true,train,car};
  }
  function coupleToSet(roster,setId,carId){
    const r=ensure(roster),set=r.trainSets.find(x=>x.id===setId),car=r.cars.find(x=>x.id===carId);
    if(!set||!car)return{ok:false,error:'No s’ha trobat la composició fixa o el vagó.'};
    if(car.trainId)return{ok:false,error:'Desacobla el vagó del tren abans d’afegir-lo a una composició fixa.'};
    if(car.trainSetId&&car.trainSetId!==set.id)return{ok:false,error:'El vagó ja pertany a una altra composició fixa.'};
    if(set.carIds.includes(car.id))return{ok:false,error:'El vagó ja forma part d’aquesta composició fixa.'};
    set.carIds.push(car.id);car.trainSetId=set.id;return{ok:true,trainSet:set,car};
  }
  function uncoupleFromSet(roster,setId,carId){
    const r=ensure(roster),set=r.trainSets.find(x=>x.id===setId),car=r.cars.find(x=>x.id===carId);
    if(!set||!car||!set.carIds.includes(car.id)||car.trainSetId!==set.id)return{ok:false,error:'El vagó no pertany a aquesta composició fixa.'};
    if(car.trainId)return{ok:false,error:'El vagó forma part d’un tren assignat; retira primer el tren.'};
    set.carIds=set.carIds.filter(id=>id!==car.id);car.trainSetId=null;return{ok:true,trainSet:set,car};
  }
  function setSpeedProfile(roster,engineId,profile){
    const r=ensure(roster),id=String(engineId||'').trim(),maxKmh=Number(profile?.maxKmh),points=Array.isArray(profile?.points)?profile.points:[];
    if(!id)return{ok:false,error:'Cal seleccionar una locomotora registrada.'};
    if(!Number.isFinite(maxKmh)||maxKmh<1||maxKmh>500)return{ok:false,error:'La velocitat màxima ha d’estar entre 1 i 500 km/h.'};
    if(points.length>64||points.some(p=>!Number.isFinite(Number(p.step))||!Number.isFinite(Number(p.kmh))||Number(p.step)<0||Number(p.step)>126||Number(p.kmh)<0||Number(p.kmh)>500))return{ok:false,error:'Punts de calibratge no vàlids.'};
    r.speedProfiles[id]={maxKmh,points:points.map(p=>({step:Number(p.step),kmh:Number(p.kmh)})),source:'MANUAL_ESTIMATE_ONLY',verified:false,updatedAt:Date.now()};
    return{ok:true,profile:r.speedProfiles[id]};
  }
  function remove(roster,kind,id,options={}){
    const r=ensure(roster);
    if(options.editMode!==true)return{ok:false,error:'Activa el mode d’edició de trens abans d’eliminar elements.'};
    if(kind==='train'){
      const train=r.trains.find(x=>x.id===id);if(!train)return{ok:false,error:'Tren no trobat.'};
      if(options.activeEngineIds?.includes(train.engineId)&&train.engineId)return{ok:false,error:'No es pot eliminar un tren amb una locomotora en circulació activa.'};
      train.carIds.forEach(carId=>{const car=r.cars.find(x=>x.id===carId);if(car)car.trainId=null;});r.trains=r.trains.filter(x=>x.id!==id);return{ok:true};
    }
    if(kind==='set'){
      const set=r.trainSets.find(x=>x.id===id);if(!set)return{ok:false,error:'Composició fixa no trobada.'};
      if(set.carIds.length)return{ok:false,error:'Retira tots els vagons de la composició abans d’eliminar-la.'};
      r.trainSets=r.trainSets.filter(x=>x.id!==id);return{ok:true};
    }
    if(kind==='car'){
      const car=r.cars.find(x=>x.id===id);if(!car)return{ok:false,error:'Vagó no trobat.'};if(car.trainId||car.trainSetId)return{ok:false,error:'Desacobla el vagó de la composició abans d’eliminar-lo.'};r.cars=r.cars.filter(x=>x.id!==id);return{ok:true};
    }
    return{ok:false,error:'Només es poden eliminar trens o vagons des del registre.'};
  }
  const api={ensure,addCar,addTrainSet,addTrain,couple,uncouple,coupleToSet,uncoupleFromSet,setSpeedProfile,remove,TYPES};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.JMRI_TC_TRAIN_ROSTER=api;
})(typeof window!=='undefined'?window:globalThis);
