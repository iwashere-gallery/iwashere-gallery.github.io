const works=new Map(/* catalog */ []);
const catalog=/* photographs */ [];
const studioPage=/* studio document */ '';
const media=new Map(/* hosted media */ []);
const previewKey=/* preview key */ '';
let previewCipher;
const collectionKey='ready/'+(/* media revision */ 'local');
let pagesCatalog, pagesCatalogUntil=0, pagesCatalogRequest;
async function currentPagesWorks(){
 if(Date.now()<pagesCatalogUntil)return pagesCatalog;
 if(!pagesCatalogRequest)pagesCatalogRequest=(async()=>{
  const response=await fetch(pagesOrigin+'/gallery.json',{redirect:'error',signal:AbortSignal.timeout(6000)});
  // The original collection remains available during the first Pages deployment.
  if(response.status===404)return works;
  if(!response.ok)throw Error('Could not read published gallery');
  const list=await response.json();
  if(!Array.isArray(list)||list.some(w=>typeof w?.id!=='string'))throw Error('Invalid published gallery');
  return new Set(list.map(w=>w.id));
 })();
 try{
  pagesCatalog=await pagesCatalogRequest;
  pagesCatalogUntil=Date.now()+30000;
  return pagesCatalog;
 }finally{pagesCatalogRequest=null}
}
async function photoFile(name,request,env){
 const item=media.get(name);
 if(!item)return new Response(null,{status:404});
 if(item.packed){
  const sealed=await env.ASSETS.fetch(new Request(new URL(item.packed,request.url)));
  if(!sealed.ok)return json({},404);
  const data=new Uint8Array(await sealed.arrayBuffer());
  previewCipher??=crypto.subtle.importKey('raw',Uint8Array.from(atob(previewKey),c=>c.charCodeAt(0)),'AES-GCM',false,['decrypt']);
  const jpeg=await crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12)},await previewCipher,data.slice(12));
  return new Response(jpeg,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-cache'}});
 }
 const stored=await env.BUCKET.get('photos/'+item.hash);
 const file=stored;
 if(!file)return json({},404);
 return new Response(file.body,{headers:{'Content-Type':'image/jpeg','Content-Length':String(file.size),'Cache-Control':'private, no-cache',ETag:file.httpEtag}});
}
const ownerDigest='a7f97d49db4bbaf0e4db326f25338158833da2d57fc18b35e6f45532c9b4f1ae';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
async function owner(request){
 const email=request.headers.get('oai-authenticated-user-email');
 if(!email||!request.headers.get('oai-authenticated-user-id'))return false;
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email.trim().toLowerCase()));
 return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('')===ownerDigest;
}
async function handle(request,env){
 const url=new URL(request.url), path=url.pathname, method=request.method;
 const q=(sql,...args)=>args.length?env.DB.prepare(sql).bind(...args):env.DB.prepare(sql);
 const deleted=async id=>!!await q('SELECT photo FROM removed_works WHERE photo=?',id).first();
 if(['/studio','/studio/','/studio.html','/api/studio/page'].includes(path)){
  if(method!=='GET'||!await owner(request))return json({},403);
  return new Response(studioPage,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
 }
 if(path==='/api/session'&&method==='GET')return json({owner:await owner(request)});
 if((path==='/gallery.json'||path==='/api/gallery')&&method==='GET'){
  const rows=await q('SELECT photo FROM removed_works').all(),removed=new Set(rows.results.map(r=>r.photo));
  return json(catalog.filter(work=>!removed.has(work.id)));
 }
 if(path.startsWith('/media/')||path.startsWith('/api/media/')){
  const name=path.split('/').pop(),item=media.get(name);
  if(!media.size&&method==='GET'&&path.startsWith('/media/')){
   const work=catalog.find(w=>[w.preview,w.detail,w.signed].includes(path.slice(1)));
   if(work&&!await deleted(work.id))return env.ASSETS.fetch(request);
  }
  if(method!=='GET'||!item||await deleted(item.photo))return json({},404);
  return photoFile(name,request,env);
 }
 if(!path.startsWith('/api/'))return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
 if(!['GET','POST','DELETE'].includes(method))return json({},405);
 if(method!=='GET' && !pagesRoute(request) && (request.headers.get('Origin')!==url.origin || request.headers.get('Sec-Fetch-Site')==='cross-site'))return json({},403);
 if(path==='/api/media-ready'&&method==='GET')return json({ready:!!(await env.BUCKET.head(collectionKey))});
 if(path.startsWith('/api/studio/import/')){
  if(!await owner(request))return json({},403);
  const name=path.slice('/api/studio/import/'.length);
  if(name==='manifest'&&method==='GET')return json([...media].filter(([,v])=>v.hash).map(([k])=>k));
  if(name==='finish'&&method==='POST'){
   // Each list is bounded; avoid one storage subrequest per photograph.
   const needed=new Set([...media.values()].filter(item=>item.hash).map(item=>'photos/'+item.hash));
   let cursor;
   do{const page=await env.BUCKET.list({prefix:'photos/',cursor,limit:1000});
    for(const entry of page.objects)needed.delete(entry.key);
    cursor=page.truncated?page.cursor:undefined;
   }while(cursor);
   if(needed.size)return json({missing:needed.size},409);
   await env.BUCKET.put(collectionKey,'complete');return json({ready:true});
  }
  const item=media.get(name);
  if(!item?.hash||method!=='POST')return json({},404);
  if(Number(request.headers.get('content-length'))!==item.size)return json({},400);
  const key='photos/'+item.hash;
  if(await env.BUCKET.head(key))return json({stored:true});
  const bytes=await request.arrayBuffer();
  if(bytes.byteLength!==item.size)return json({},400);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==item.hash)return json({error:'different_file'},422);
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
  return json({stored:true});
 }
 const download=path.match(/^\/api\/download\/([^/]+)$/);
 if(download){
  if(method!=='GET')return json({},405);
  const photo=decodeURIComponent(download[1]),signed=works.get(photo),key=url.searchParams.get('request');
  if(!signed||await deleted(photo))return json({},404);
  if(!uuid.test(key||''))return json({},400);
  if(/prefetch/i.test((request.headers.get('Purpose')||'')+' '+(request.headers.get('Sec-Purpose')||'')))return new Response(null,{status:204});
  const assetURL=new URL('/'+signed,url),assetHeaders=new Headers(request.headers);
  if(assetURL.origin!==url.origin)return json({},404);
  for(const name of ['Range','If-Range','If-None-Match','If-Modified-Since'])assetHeaders.delete(name);
  assetHeaders.set('Accept','image/jpeg');
  const assetRequest=new Request(assetURL,{headers:assetHeaders});
  const file=signed.startsWith('api/media/')?await photoFile(signed.slice('api/media/'.length),assetRequest,env):
   env.ASSETS?await env.ASSETS.fetch(assetRequest):await fetch(assetRequest,{redirect:'manual'});
  if(file.status!==200||!/^image\/jpeg\b/i.test(file.headers.get('Content-Type')||''))return json({error:'photo_unavailable'},503);
  const filename='LiwangxuShen-'+photo.replace(/[^a-z0-9_-]/gi,'_')+'.jpg';
  const headers=new Headers({'Content-Type':'image/jpeg','Content-Disposition':'attachment; filename="'+filename+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  if(file.headers.has('Content-Length'))headers.set('Content-Length',file.headers.get('Content-Length'));
  try{await q('INSERT OR IGNORE INTO download_events(event_key,photo,created) VALUES (?,?,?)',photo+':'+key,photo,Date.now()).run()}
  catch{console.error('Download counter unavailable')}
  return new Response(file.body,{headers});
 }
 if(path.startsWith('/api/studio/')){
  if(!await owner(request))return json({},403);
  const removeWork=path.match(/^\/api\/studio\/works\/([^/]+)\/remove$/);
  if(removeWork&&method==='POST'){
   const photo=decodeURIComponent(removeWork[1]);
   if(!works.has(photo))return json({},404);
   await q('INSERT OR IGNORE INTO removed_works(photo) VALUES (?)',photo).run();
   return json({removed:photo});
  }
  if(path==='/api/studio/stats'&&method==='GET'){
   const results=await env.DB.batch([q("SELECT count(*) AS n FROM view_events WHERE photo=''"),q("SELECT photo,count(*) AS n FROM view_events WHERE photo<>'' AND photo NOT IN (SELECT photo FROM removed_works) GROUP BY photo ORDER BY n DESC,photo"),q('SELECT count(*) AS n FROM messages WHERE photo NOT IN (SELECT photo FROM removed_works)'),q('SELECT photo,count(*) AS n FROM download_events WHERE photo NOT IN (SELECT photo FROM removed_works) GROUP BY photo ORDER BY n DESC,photo'),q('SELECT photo,created FROM download_events WHERE photo NOT IN (SELECT photo FROM removed_works) ORDER BY created DESC LIMIT 30')]);
   return json({visits:results[0].results[0].n,ranking:results[1].results,comments:results[2].results[0].n,downloads:results[3].results,recentDownloads:results[4].results});
  }
  if(path==='/api/studio/threads'&&method==='GET'){
   const rows=await q(`SELECT id,photo,nickname,body,created,total FROM (
    SELECT id,photo,nickname,body,created,
     COUNT(*) OVER (PARTITION BY photo) AS total,
     MAX(id) OVER (PARTITION BY photo) AS latest,
     ROW_NUMBER() OVER (PARTITION BY photo ORDER BY id DESC) AS position
    FROM messages WHERE photo NOT IN (SELECT photo FROM removed_works)
   ) WHERE position<=5 ORDER BY latest DESC,id DESC`).all();
   const groups=new Map();
   for(const {total,...message} of rows.results){
    if(!groups.has(message.photo))groups.set(message.photo,{photo:message.photo,total,messages:[]});
    groups.get(message.photo).messages.push(message);
   }
   return json({threads:[...groups.values()]});
  }
  const removal=path.match(/^\/api\/studio\/messages\/(\d+)(\/remove)?$/);
  if(removal&&(method==='DELETE'&&!removal[2]||method==='POST'&&removal[2])){
   const removed=await q('DELETE FROM messages WHERE id=? RETURNING id,photo',Number(removal[1])).first();
   return removed?json({ok:true,...removed}):json({error:'already_removed'},404);
  }
 }
 const pageSize=25;
 const cursor=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);
 if(!Number.isSafeInteger(cursor)||cursor<=0)return json({},400);
 const messages=async(photo)=>{
  const data=await q('SELECT id,photo,nickname,body,created FROM messages WHERE photo NOT IN (SELECT photo FROM removed_works) AND id<?'+(photo?' AND photo=?':'')+' ORDER BY id DESC LIMIT 26',cursor,...(photo?[photo]:[])).all();
  return {messages:data.results.slice(0,pageSize),before:data.results.length>pageSize?data.results[pageSize-1].id:null};
 };
 if(path==='/api/studio/messages'&&method==='GET')return json(await messages());
 let data;
 if(method==='POST'){
  if(!/^application\/json\b/i.test(request.headers.get('Content-Type')||''))return json({},415);
  const raw=await request.text();if(raw.length>9000)return json({},413);
  try{data=JSON.parse(raw)}catch{return json({},400)}
  if(!data||typeof data!=='object'||!uuid.test(data.key))return json({},400);
 }
 if(path==='/api/visits'&&['POST','GET'].includes(method)){
  if(data)await q("INSERT OR IGNORE INTO view_events VALUES (?,'')",'visit:'+data.key).run();
  return json(await q("SELECT count(*) AS n FROM view_events WHERE photo=''").first());
 }
 const [,photo,action]=path.match(/^\/api\/works\/([^/]+)(?:\/(view|messages|download))?$/)||[];
 if(!photo)return json({},404);
 const published=pagesRoute(request)?await currentPagesWorks():works;
 if(!published.has(photo)||await deleted(photo))return json({},404);
 if(method==='POST'&&action==='download'){
  await q('INSERT OR IGNORE INTO download_events(event_key,photo,created) VALUES (?,?,?)',photo+':'+data.key,photo,Date.now()).run();
  return json({recorded:true});
 }
 if(method==='POST'&&action==='view'){
  await q('INSERT OR IGNORE INTO view_events VALUES (?,?)',photo+':'+data.key,photo).run();
 }else if(method==='POST'&&action==='messages'){
  if(typeof data.body!=='string'||typeof data.nickname!=='string'||!uuid.test(data.guest))return json({},400);
  const body=data.body.trim(),nickname=data.nickname.trim(),now=Date.now();
  if(!body||body.length>800||nickname.length>40)return json({},400);
  const submission=photo+':'+data.key;
  await q('INSERT OR IGNORE INTO messages(photo,nickname,body,created,guest,submission) SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM messages WHERE guest=? AND created>?)',photo,nickname,body,now,data.guest,submission,data.guest,now-12000).run();
  if(!await q('SELECT id FROM messages WHERE submission=?',submission).first())return json({},429);
 }else if(method!=='GET'||action)return json({},405);
 const counts=await q('SELECT (SELECT count(*) FROM view_events WHERE photo=?) AS views,(SELECT count(*) FROM messages WHERE photo=?) AS comments',photo,photo).first();
 return json({...counts,...await messages(photo)});
}
const pagesOrigin='https://iwashere-gallery.github.io';
function pagesRoute(request){
 const path=new URL(request.url).pathname;
 return request.headers.get('Origin')===pagesOrigin &&
  (path==='/api/visits'||/^\/api\/works\/[a-zA-Z0-9_-]+(?:\/(?:messages|view|download))?$/.test(path));
}
export default {async fetch(request,env){
 const shared=pagesRoute(request);
 let response;
 try{
  response=shared&&request.method==='OPTIONS'?new Response(null,{status:204}):await handle(request,env);
 }catch{response=json({error:'temporarily_unavailable'},503)}
 if(shared){
  response.headers.set('Access-Control-Allow-Origin',pagesOrigin);
  response.headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers','Content-Type');
  response.headers.append('Vary','Origin');
 }
 return response;
}};
