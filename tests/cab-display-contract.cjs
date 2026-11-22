'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
for(const id of ['tpAckGreen','tpAckYellow','tpAckGreenYellow','tg15SegmentDisplay','spieleweltDepot'])assert.ok(html.includes('id="'+id+'"'),'Missing cab display/control '+id);
console.log('PASS: three square acknowledgements, 15-segment radio readout and depot selector');