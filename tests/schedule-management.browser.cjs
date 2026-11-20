'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end(String(err));return;}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);});});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser,context;try{browser=await chromium.launch({headless:true,args:['--no-sandbox']});context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>console.error('Schedule browser error:',e.stack||e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');await page.waitForFunction(()=>window.JMRI_TC_SCHEDULE_UI&&window.JMRI_TC_SCHEDULES&&window.JMRI_TC_DISPATCHER);
// Isolate this module test from other floating panels. The desktop intentionally allows
// overlapping windows, so unrelated windows must not obscure the schedule form in this test.
await page.evaluate(()=>{
 const target=document.querySelector('#schedulePanel')?.closest('.desktop-window');
 if(!target)throw new Error('Schedule panel is not registered as a floating window');
 document.querySelectorAll('.desktop-window').forEach(win=>{win.hidden=win!==target;});
 target.hidden=false;
 if(!window.JMRI_TC_DESKTOP.focusWindow(target.getAttribute('aria-label')))throw new Error('Could not focus the schedule window');
 const button=document.querySelector('#scheduleSave');
 if(!button)throw new Error('Schedule save button is missing');
 button.scrollIntoView({block:'center',inline:'center'});
});
// Verify the actual control receives pointer hits after it has been scrolled into view.
await page.waitForFunction(()=>{const b=document.querySelector('#scheduleSave');if(!b)return false;const r=b.getBoundingClientRect();if(r.width<=0||r.height<=0||r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)return false;const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===b||b.contains(hit);});await page.evaluate(()=>{const c=window.JMRI_TC_DISPATCHER.getConfig();c.dispatcher={routes:[{id:'R-SCH-1',name:'Ruta de prova',blockIds:['B1','B2'],turnoutRequirements:[]}]};c.traffic={locomotives:[{id:'L-SCH-1',name:'Locomotora de prova',wiThrottleId:'S3'}]};window.JMRI_TC_DISPATCHER.refresh();});
const create=async(name,time)=>{await page.locator('#scheduleName').fill(name);await page.locator('#scheduleRoute').selectOption('R-SCH-1');await page.locator('#scheduleLoco').selectOption('L-SCH-1');await page.locator('#scheduleTime').fill(time);await page.locator('#scheduleSave').click();};
await create('Tren matí','08:30');await page.waitForFunction(()=>window.JMRI_TC_DISPATCHER.getConfig().schedules?.schedules?.length===1);
await create('Tren tarda','15:30');await page.waitForFunction(()=>window.JMRI_TC_DISPATCHER.getConfig().schedules.schedules.length===2);
let ids=await page.evaluate(()=>window.JMRI_TC_DISPATCHER.getConfig().schedules.schedules.map(x=>x.id));
await page.locator('#scheduleSuccessorSource').selectOption(ids[0]);await page.locator('#scheduleSuccessorTarget').selectOption(ids[1]);await page.locator('#scheduleSuccessorAdd').click();
await page.waitForFunction(id=>window.JMRI_TC_DISPATCHER.getConfig().schedules.schedules.find(x=>x.id===id).successorIds.includes(window.JMRI_TC_DISPATCHER.getConfig().schedules.schedules.find(x=>x.id!==id).id),ids[0]);
await page.locator('#scheduleSuccessorSource').selectOption(ids[1]);await page.locator('#scheduleSuccessorTarget').selectOption(ids[0]);await page.locator('#scheduleSuccessorAdd').click();
assert.match(await page.locator('#scheduleMessage').textContent(),/cicle/i,'successor cycles must be rejected');
await page.locator('#scheduleList article').nth(0).getByRole('button',{name:'Editar'}).click();await page.locator('#scheduleName').fill('Tren matí revisat');await page.locator('#scheduleSave').click();
await page.waitForFunction(id=>window.JMRI_TC_DISPATCHER.getConfig().schedules.schedules.find(x=>x.id===id)?.name==='Tren matí revisat',ids[0]);
assert.deepEqual(await page.evaluate(id=>window.JMRI_TC_DISPATCHER.getConfig().schedules.schedules.find(x=>x.id===id).successorIds,ids[0]),[ids[1]],'editing a schedule must preserve successors');
await page.locator('#scheduleList article').nth(0).getByRole('button',{name:'Desactivar'}).click();assert.equal(await page.evaluate(id=>window.JMRI_TC_DISPATCHER.getConfig().schedules.schedules.find(x=>x.id===id).enabled,ids[0]),false);
await page.locator('#scheduleSuccessorSource').selectOption(ids[0]);await page.locator('#scheduleSuccessorTarget').selectOption(ids[1]);await page.locator('#scheduleSuccessorRemove').click();assert.deepEqual(await page.evaluate(id=>window.JMRI_TC_DISPATCHER.getConfig().schedules.schedules.find(x=>x.id===id).successorIds,ids[0]),[]);
await page.locator('[data-ribbon-tab="schedules"]').click();await page.locator('[data-ribbon-command="scheduleList"]').click();
const saved=await page.evaluate(()=>JSON.parse(JSON.stringify(window.JMRI_TC_DISPATCHER.getConfig().schedules)));assert.equal(saved.schedules.length,2);assert.equal(saved.schedules[0].name,'Tren matí revisat');
console.log('PASS: Chromium schedule creation/edit/toggle, project persistence, successor add/remove/cycle guard and modern ribbon commands; no physical execution');
}finally{await context?.close().catch(()=>{});await browser?.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exitCode=1;});
