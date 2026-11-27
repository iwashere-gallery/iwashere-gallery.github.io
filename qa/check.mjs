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
const fixture={id:'qa-new-publication',preview:'media/qa.jpg',detail:'media/qa-hd.jpg',signed:'media/qa-signed.jpg'};
const original=catalog[0]||{id:'qa-original',signed:'media/qa-original.jpg'};
const source=template.replace('/* catalog */ []',()=>JSON.stringify([[original.id,original.signed]]))
 .replace('/* photographs */ []',()=>JSON.stringify(catalog));
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const db=localDatabase(':memory:');
const backend='https://i-was-here-photography.shenliwangxu.chatgpt.site';
const origin='https://iwashere-gallery.github.io';
let published=[original,fixture];
let fetchCount=0;
globalThis.fetch=async url=>{
 assert.equal(url,origin+'/gallery.json');
 fetchCount++;
 return Response.json(published);
};
const route='works/'+fixture.id;
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
assert.equal(fetchCount,1);
const {removeGitHubWork}=await import('../backend/github-gallery.js');
const sibling={...original,preview:fixture.preview};
const snapshot={gallery:[sibling,fixture],commit:async tree=>{
 const changes=tree.filter(entry=>entry.sha===null).map(entry=>entry.path);
 assert.deepEqual(changes,['docs/'+fixture.detail,'docs/'+fixture.signed]);
 published=JSON.parse(tree.find(entry=>entry.path==='docs/gallery.json').content);
}};
assert.equal(await removeGitHubWork(snapshot,fixture.id),true);
assert.deepEqual(published,[sibling]);
assert.equal(await removeGitHubWork({...snapshot,gallery:published},fixture.id),false);
const now=Date.now;
try{
 Date.now=()=>now()+31000;
 assert.equal((await call(route)).status,404);
 assert.equal((await call(route+'/messages','POST',message)).status,404);
 assert.equal((await call(route+'/download','POST',event)).status,404);
 assert.equal((await call('works/'+original.id)).status,200);
}finally{Date.now=now}
console.log('New publication accepts messages and download counts. Removal preserves shared files and closes the removed thread.');
// Verify the GitHub transport against an isolated repository, including a concurrent edit.
const {openGitHubGallery}=await import('../backend/github-gallery.js');
const repo='qa/photographs',base='https://api.github.com/repos/'+repo;
let head='initial',sequence=0;
const trees=new Map(),commits=new Map();
const bytes=text=>Buffer.from(text).toString('base64');
globalThis.fetch=async(url,options)=>{
 assert.ok(url.startsWith(base));
 const path=url.slice(base.length),payload=options.body&&JSON.parse(options.body);
 if(options.method!=='GET')assert.equal(options.headers.Authorization,'Bearer test-only');
 if(path==='')return Response.json({default_branch:'main'});
 if(path==='/git/ref/heads/main')return Response.json({object:{sha:head}});
 if(path.startsWith('/git/commits/'))return Response.json({tree:{sha:'base-tree'}});
 if(path.startsWith('/contents/docs/gallery-id.txt?ref='))return Response.json({content:bytes('liwangxushen-photo-gallery-v1')});
 if(path.startsWith('/contents/docs/gallery.json?ref='))return Response.json({content:bytes(JSON.stringify(published))});
 if(path==='/git/trees'){const sha='tree-'+ ++sequence;trees.set(sha,payload.tree);return Response.json({sha})}
 if(path==='/git/commits'){const sha='commit-'+ ++sequence;commits.set(sha,payload);return Response.json({sha})}
 if(path==='/git/refs/heads/main'){
  assert.equal(payload.force,false);
  const revision=commits.get(payload.sha);
  if(revision.parents[0]!==head)return Response.json({message:'Branch changed'},{status:422});
  published=JSON.parse(trees.get(revision.tree).find(entry=>entry.path==='docs/gallery.json').content);
  head=payload.sha;return Response.json({object:{sha:head}});
 }
 throw Error('Unexpected test request '+path);
};
const before=await openGitHubGallery(repo,'test-only');
await before.commit([{path:'docs/gallery.json',mode:'100644',type:'blob',content:JSON.stringify([sibling,fixture])}],'Publish fixture');
const stale=await openGitHubGallery(repo,'test-only');
head='concurrent-edit';
await assert.rejects(()=>removeGitHubWork(stale,fixture.id),/422/);
assert.deepEqual(published,[sibling,fixture]);
await removeGitHubWork(await openGitHubGallery(repo,'test-only'),fixture.id);
assert.deepEqual((await openGitHubGallery(repo)).gallery,[sibling]);
console.log('Repository publication, concurrent-edit protection and removal retry passed.');
console.log('Visitor counts, photo views, guestbook persistence, signed-download deduplication, CORS and owner access checks passed.');
