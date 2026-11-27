import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {localDatabase} from './local-db.mjs';

const catalog=JSON.parse(await readFile('docs/gallery.json','utf8'));
const expected=new Set();
function dimensions(bytes){
 assert.equal(bytes.readUInt16BE(0),0xffd8);
 assert.equal(bytes.readUInt16BE(bytes.length-2),0xffd9);
 for(let offset=2;offset+8<bytes.length;){
  assert.equal(bytes[offset],255);
  const marker=bytes[offset+1];
  if([192,193,194].includes(marker))return [bytes.readUInt16BE(offset+7),bytes.readUInt16BE(offset+5)];
  const length=bytes.readUInt16BE(offset+2);
  assert.ok(length>=2);
  offset+=2+length;
 }
 throw Error('No JPEG dimensions');
}
for(const work of catalog){
 const sizes={};
 for(const [kind,metadata] of [['preview','preview'],['detail','detail'],['signed','original']]){
  assert.match(work[kind],/^media\/[\w-]+\.jpg$/);
  expected.add(work[kind]);
  const bytes=await readFile('docs/'+work[kind]);
  sizes[kind]=dimensions(bytes);
  const declared=[work[metadata+'Width'],work[metadata+'Height']];
  if(declared.some(value=>value!=null))assert.deepEqual(sizes[kind],declared,work[kind]);
 }
 for(const kind of ['detail','preview']){
  const [width,height]=sizes[kind], [originalWidth,originalHeight]=sizes.signed;
  assert.ok(width>0&&height>0&&width<=originalWidth&&height<=originalHeight,work[kind]);
  assert.ok(Math.abs(width*originalHeight-height*originalWidth)<=Math.max(originalWidth,originalHeight),work[kind]);
 }
}
assert.equal(expected.size,catalog.length*3);
assert.deepEqual(new Set((await readdir('docs/media')).map(n=>'media/'+n)),expected);
console.log('Verified',catalog.length,'works and',expected.size,'catalogued JPEG files.');

// Reuse production handler and SQL migrations with an isolated database.
const template=await readFile('backend/index.mjs','utf8');
const source=template.replace('/* catalog */ []',()=>JSON.stringify(catalog.map(w=>[w.id,w.signed])))
 .replace('/* photographs */ []',()=>JSON.stringify(catalog));
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const db=localDatabase(':memory:');
const backend='https://i-was-here-photography.shenliwangxu.chatgpt.site';
const origin='https://iwashere-gallery.github.io';
const route='works/'+catalog[0].id;
async function call(path,method='GET',data){
 return worker.fetch(new Request(backend+'/api/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},
 body:data?JSON.stringify(data):undefined}),{DB:db});
}
for(const path of ['visits',route,route+'/view',route+'/messages',route+'/download']){
 const preflight=await call(path,'OPTIONS');
 assert.equal(preflight.status,204);
 assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
}
const event={key:crypto.randomUUID()};
for(const path of ['visits',route+'/view',route+'/download']){
 for(let attempt=0;attempt<2;attempt++)assert.equal((await call(path,'POST',event)).status,200);
}
assert.equal((await (await call('visits')).json()).n,1);
assert.equal((await (await call(route)).json()).views,1);
assert.equal((await db.prepare('SELECT count(*) AS n FROM download_events').first()).n,1);
const message={key:crypto.randomUUID(),guest:crypto.randomUUID(),nickname:'QA',body:'Gallery test'};
for(let attempt=0;attempt<2;attempt++)assert.equal((await call(route+'/messages','POST',message)).status,200);
const thread=await (await call(route)).json();
assert.equal(thread.comments,1);
assert.equal(thread.messages[0].body,message.body);
assert.equal((await call('studio/stats')).status,403);
assert.equal((await call('works/missing/download','POST',event)).status,404);
console.log('Visitor counts, photo views, guestbook persistence, signed-download deduplication, CORS and owner access checks passed.');
