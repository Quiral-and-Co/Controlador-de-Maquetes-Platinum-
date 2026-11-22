'use strict';
const assert=require('node:assert/strict');
const core=require('../rolling-stock-core');
const importer=require('../rolling-stock-import-core');
const cs2=`[lokomotive]
version
.major=0
.minor=3
session
.id=24
lokomotive
.uid=0xc002
.name=BR 89
.vorname=BR 89
.adresse=0x3e8
.typ=mfx
.mfxuid=0x12345678
.icon=steam
.tachomax=350
.funktionen
..nr=0
..typ=1
..dauer=0
..wert=0
..nr=1
..typ=2
..dauer=1
..wert=1
[lokomotive]
lokomotive
.uid=0x42
.name=Diesel
.adresse=0x3
.typ=dcc
.icon=diesel
.funktionen
..nr=0
..typ=1
`;
const rows=importer.parseCs2(cs2);
assert.equal(rows.length,2);
assert.equal(rows[0].name,'BR 89');
assert.equal(rows[0].protocol,'MFX');
assert.equal(rows[0].address,'1000');
assert.equal(rows[0].functions.length,2);
assert.equal(rows[1].protocol,'DCC');
const mm2=importer.parseCs2(cs2.replace('.typ=dcc','.typ=mm2'));
assert.equal(mm2[1].protocol,'MM2','CS2 MM2 decoders must not be misclassified as DCC');
assert.equal(importer.importText('backup.cs2',cs2).vehicles.length,2);
const z21={layout:{locomotives:[{id:'z1',name:'Railjet',address:12,format:'DCC',functions:[{number:0,name:'Llums',icon:'light'}],image:'railjet.png',articleNumber:'73220'}]}};
const z=importer.parseZ21Json(JSON.stringify(z21));
assert.equal(z.ok,true);
assert.equal(z.vehicles[0].name,'Railjet');
assert.equal(z.vehicles[0].functions[0].icon,'light');
assert.equal(importer.importText('export.z21',JSON.stringify(z21)).ok,true);
assert.equal(importer.parseZ21Json('not-json').ok,false);
const db=core.ensureDatabase({vehicles:[]});
let merged=importer.mergeImport(db,rows);
assert.equal(merged.added,2);
merged=importer.mergeImport(db,rows);
assert.equal(merged.updated,2,'repeat import updates matching source identities without duplicates');
assert.equal(db.vehicles.length,2);
assert.equal(core.validateVehicle({name:'bad',protocol:'UNKNOWN'}).ok,false);
assert.equal(core.validateVehicle({name:'BR 89',protocol:'MFX',functions:[{number:0},{number:0}]}).ok,false);
const added=core.upsertVehicle(db,{name:'Cotxe 1',kind:'car',protocol:'DCC',functions:[]});
assert.equal(added.ok,true);
assert.equal(core.buildInventory([],{},db).length,3);
assert.equal(core.createDragPayload({id:'c',kind:'car'}),'');
assert.equal(core.createDragPayload({id:'unassigned',kind:'locomotive',controlReady:false}),'','imported locomotives must be explicitly registered before DMI drag');
assert.equal(core.createDragPayload({id:'l',kind:'locomotive'}).length>0,true);
assert.equal(core.removeVehicle(db,added.vehicle.id,{activeIds:[added.vehicle.id]}).ok,false);
assert.equal(core.removeVehicle(db,added.vehicle.id).ok,true);
console.log('PASS rolling stock import/editor core: Märklin CS2, Z21 JSON, merge idempotency, validation, manual CRUD and safety');
