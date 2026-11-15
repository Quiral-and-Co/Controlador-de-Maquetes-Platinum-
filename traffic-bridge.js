'use strict';
const http=require('node:http');
const net=require('node:net');
const fs=require('node:fs');
const path=require('node:path');
const {WebSocketServer,WebSocket}=require('ws');
const ROOT=__dirname,HOST='127.0.0.1',HTTP_PORT=Number(process.env.PORT||3000);
const DCC_ENABLED=process.env.JMRI_TC_ENABLE_DCC==='1';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end('Bad request');return;}const rel=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=path.resolve(ROOT,rel);if(rel.split('/').some(part=>part.startsWith('.'))||rel.startsWith('node_modules/')||!MIME[path.extname(file).toLowerCase()]||!file.startsWith(ROOT+path.sep)){res.writeHead(403).end('Forbidden');return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(err.code==='ENOENT'?404:500).end('Not found');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(data);});});
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
 const closeTcp=()=>{stopHeartbeat();if(tcp){try{tcp.write('M0A*<;>X\nM0-*<;>r\nQ\n');}catch{}tcp.destroy();tcp=null;}connected=false;acquired.clear();for(const timer of pendingAcquire.values())clearTimeout(timer);pendingAcquire.clear();disarm();};
