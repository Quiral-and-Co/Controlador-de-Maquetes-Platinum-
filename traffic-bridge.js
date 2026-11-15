'use strict';
const http=require('node:http');
const net=require('node:net');
const fs=require('node:fs');
const path=require('node:path');
const {WebSocketServer,WebSocket}=require('ws');
const ROOT=__dirname,HOST='127.0.0.1',HTTP_PORT=Number(process.env.PORT||3000);
const DCC_ENABLED=process.env.JMRI_TC_ENABLE_DCC==='1';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end('Bad request');return;}const rel=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=path.resolve(ROOT,rel);if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end('Forbidden');return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(err.code==='ENOENT'?404:500).end('Not found');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(data);});});
const wss=new WebSocketServer({noServer:true,maxPayload:8192});
let activeController=null;
server.on('upgrade',(req,socket,head)=>{const origin=req.headers.origin||'';if(req.url!=='/traffic-ws'||!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
function send(ws,obj){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
function validHost(host){return typeof host==='string'&&host.length<=253&&!/[\s/\\]/.test(host);}
wss.on('connection',ws=>{
 if(activeController&&activeController.readyState===WebSocket.OPEN){ws.close(1013,'Another local dispatcher is already connected.');return;}
 activeController=ws;
 let tcp=null,armed=false,connected=false,heartbeat=null,buffer='',acquired=new Set(),pendingAcquire=new Map();
 const report=()=>send(ws,{type:'status',connected,armed,dccEnabled:DCC_ENABLED,host:tcp?.remoteAddress||null});
 const stopHeartbeat=()=>{if(heartbeat)clearInterval(heartbeat);heartbeat=null;};
 const disarm=()=>{armed=false;report();};
 const closeTcp=()=>{stopHeartbeat();if(tcp){try{tcp.write('M0-*<;>r\nQ\n');}catch{}tcp.destroy();tcp=null;}connected=false;acquired.clear();for(const timer of pendingAcquire.values())clearTimeout(timer);pendingAcquire.clear();disarm();};
 const write=line=>{if(!connected||!tcp||tcp.destroyed)throw new Error('WiThrottle no està connectat.');tcp.write(line+'\n');};
 const requireArmed=()=>{if(!DCC_ENABLED||!armed)throw new Error('Control DCC bloquejat. Activa JMRI_TC_ENABLE_DCC=1 i arma el control de seguretat.');if(!connected)throw new Error('WiThrottle desconnectat.');};
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw.toString());}catch{return send(ws,{type:'error',message:'Missatge JSON invàlid.'});}
 try{
  if(m.type==='connect'){
   if(tcp)closeTcp();const host=String(m.host||'127.0.0.1'),port=Number(m.port||12090);if(!validHost(host)||!Number.isInteger(port)||port<1||port>65535)throw new Error('Host o port WiThrottle invàlid.');
   tcp=net.createConnection({host,port});tcp.setKeepAlive(true,10000);tcp.setNoDelay(true);
   tcp.on('connect',()=>{connected=true;tcp.write('NJMRI-TC Gold Custom\n');tcp.write('HUJMRI-TC-'+process.pid+'\n');tcp.write('*+\n');heartbeat=setInterval(()=>{if(connected)tcp.write('*\n');},5000);send(ws,{type:'connected'});report();});
   tcp.on('data',chunk=>{buffer+=chunk.toString('utf8');let i;while((i=buffer.search(/[\r\n]/))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1).replace(/^\n/,'');if(line){send(ws,{type:'jmri',line});for(const [id,timer] of pendingAcquire){if(line.startsWith('M0A'+id)){clearTimeout(timer);pendingAcquire.delete(id);acquired.add(id);send(ws,{type:'acquired',locoId:id});}}}}});
   tcp.on('error',err=>send(ws,{type:'error',message:'WiThrottle: '+err.message}));
   tcp.on('close',()=>{stopHeartbeat();connected=false;acquired.clear();for(const timer of pendingAcquire.values())clearTimeout(timer);pendingAcquire.clear();disarm();send(ws,{type:'disconnected'});});
  }else if(m.type==='arm'){
   if(!DCC_ENABLED)throw new Error('DCC desactivat per defecte. Cal iniciar el pont amb JMRI_TC_ENABLE_DCC=1.');
   if(!connected)throw new Error('Connecta primer amb el servidor WiThrottle de JMRI.');
   armed=m.enabled===true;report();send(ws,{type:'armed',armed});
  }else if(m.type==='acquire'){
   requireArmed();const id=String(m.locoId||''),match=/^([SL])(\d+)$/.exec(id),n=match?Number(match[2]):NaN;if(!match||(match[1]==='S'&&(n<1||n>127))||(match[1]==='L'&&(n<128||n>10239)))throw new Error('Adreça DCC no vàlida.');
   write('M0+'+id+'<;>'+id);const timer=setTimeout(()=>{pendingAcquire.delete(id);send(ws,{type:'acquireTimeout',locoId:id,message:'JMRI no ha confirmat l’adquisició de la locomotora.'});},5000);pendingAcquire.set(id,timer);send(ws,{type:'acquiring',locoId:id});
  }else if(m.type==='speed'){
   requireArmed();const id=String(m.locoId||''),speed=Number(m.speed);if(!acquired.has(id))throw new Error('La locomotora no està adquirida.');if(!Number.isInteger(speed)||speed<0||speed>126)throw new Error('Velocitat fora del rang 0–126.');write('M0A'+id+'<;>V'+speed);send(ws,{type:'command',command:'speed',locoId:id,speed});
  }else if(m.type==='direction'){
   requireArmed();const id=String(m.locoId||''),direction=Number(m.direction);if(!acquired.has(id)||![0,1].includes(direction))throw new Error('Locomotora no adquirida o sentit invàlid.');write('M0A'+id+'R'+direction);send(ws,{type:'command',command:'direction',locoId:id,direction});
  }else if(m.type==='function'){
   requireArmed();const id=String(m.locoId||''),fn=Number(m.fn);if(!acquired.has(id)||!Number.isInteger(fn)||fn<0||fn>31)throw new Error('Locomotora no adquirida o funció invàlida.');write('M0A'+id+'<;>F'+(m.enabled?1:0)+fn);send(ws,{type:'command',command:'function',locoId:id,fn,enabled:!!m.enabled});
  }else if(m.type==='release'){
   requireArmed();const id=String(m.locoId||'');if(acquired.has(id)){write('M0-'+id+'<;>r');acquired.delete(id);}send(ws,{type:'released',locoId:id});
  }else if(m.type==='emergencyStop'){
   if(connected&&tcp&&!tcp.destroyed){const id=String(m.locoId||'');if(id&&acquired.has(id))tcp.write('M0A'+id+'<;>X\n');else tcp.write('M0A*<;>X\n');}
   disarm();send(ws,{type:'emergencyStop',message:'Ordre d’emergència enviada a JMRI si la connexió era activa.'});
  }else if(m.type==='disconnect'){closeTcp();send(ws,{type:'disconnected'});}
  else throw new Error('Acció no admesa pel pont.');
 }catch(err){send(ws,{type:'error',message:err.message});}
 });
 ws.on('close',()=>{closeTcp();if(activeController===ws)activeController=null;});ws.on('error',closeTcp);report();
});
server.listen(HTTP_PORT,HOST,()=>{console.log('JMRI-TC local: http://'+HOST+':'+HTTP_PORT);console.log('WiThrottle bridge: ws://'+HOST+':'+HTTP_PORT+'/traffic-ws');console.log('DCC commands enabled: '+DCC_ENABLED);});
process.on('SIGINT',()=>{for(const client of wss.clients)client.close();server.close(()=>process.exit(0));});
