import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {localDatabase} from './local-db.mjs';

const front='http://127.0.0.1:5186',api='http://127.0.0.1:5187';
const root=resolve('docs');
const catalog=JSON.parse(await readFile(resolve(root,'gallery.json'),'utf8'));
const template=await readFile('backend/index.mjs','utf8');
const source=template.replace('/* catalog */ []',()=>JSON.stringify(catalog.map(w=>[w.id,w.signed])))
 .replace('/* photographs */ []',()=>JSON.stringify(catalog)).replace('https://iwashere-gallery.github.io',front);
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const db=localDatabase(':memory:');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.json':'application/json','.wav':'audio/wav'};
http.createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,front).pathname;
  const file=resolve(root,'.'+(path==='/'?'/index.html':decodeURIComponent(path)));
  if(!file.startsWith(root+sep))throw Error('Invalid file');
  let bytes=await readFile(file);
  if(path==='/service.js')bytes=Buffer.from(bytes.toString().replace('https://i-was-here-photography.shenliwangxu.chatgpt.site',api));
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
}).listen(5186,'127.0.0.1');
http.createServer(async(req,res)=>{
 try{
  const parts=[];for await(const chunk of req)parts.push(chunk);
  const response=await worker.fetch(new Request(new URL(req.url,api),{method:req.method,headers:req.headers,body:parts.length?Buffer.concat(parts):undefined}),{DB:db});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end();}
}).listen(5187,'127.0.0.1');
console.log(front);
