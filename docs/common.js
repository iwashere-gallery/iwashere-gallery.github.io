export const el=id=>document.getElementById(id);
export const language=()=>localStorage.getItem('gallery-language')==='zh'?'zh':'en';
export function phrase(zh,en){return language()==='zh'?zh:en}
export function drafts(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open('shen-photo-studio-v1',2);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('works'))db.createObjectStore('works',{keyPath:'id'});
   if(!db.objectStoreNames.contains('images'))db.createObjectStore('images');
  };
  req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result)};req.onerror=()=>reject(req.error);
 });
}
export async function dbOp(method,arg){
 const db=await drafts();
 return new Promise((resolve,reject)=>{
  const write=method!=='getAll';
  const tx=db.transaction(write?['works','images']:['works'],write?'readwrite':'readonly');
  const works=tx.objectStore('works');let req;
  if(method==='put'){
   const {detailBlob,signedBlob,...work}=arg;
   tx.objectStore('images').put(detailBlob,[work.id,'detail']);
   tx.objectStore('images').put(signedBlob,[work.id,'signed']);
   req=works.put({...work,separateImages:true});
  }else if(method==='delete'){
   const images=tx.objectStore('images');
   images.delete([arg,'detail']);images.delete([arg,'signed']);req=works.delete(arg);
  }else req=works.getAll();
  tx.oncomplete=()=>{db.close();resolve(req.result)};
  tx.onabort=tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
export async function draftImage(work,kind){
 if(!work.separateImages||kind==='preview')return work[kind+'Blob'];
 const db=await drafts();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('images'),req=tx.objectStore('images').get([work.id,kind]);
  tx.oncomplete=()=>{db.close();req.result?resolve(req.result):reject(Error('Draft image missing'))};
  tx.onabort=tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
export const photoHash=id=>'#photo/'+encodeURIComponent(id);
export const commentsHash=id=>photoHash(id)+'/comments';
export const titleOf=p=>(language()==='zh'?p.zh||p.en:p.en||p.zh)||phrase('未命名','Untitled');
export const cityOf=p=>language()==='zh'?p.cityZh||p.cityEn:p.cityEn||p.cityZh;
export function displayLens(camera,lens){
 const name=String(lens||'').split('\0',1)[0].trim();
 return /\bZ\s*30\b/i.test(camera||'')?name.replace(/\s+VR$/i,''):name;
}
export async function readGallery(){
 const url=location.hostname.endsWith('.chatgpt.site')?'/api/gallery':'./gallery.json';
 const r=await fetch(url,{cache:'no-store'});
 if(!r.ok)throw Error('gallery.json '+r.status);
 const list=await r.json();
 if(list.some(work=>work.signed?.startsWith('api/media/'))){
  const state=await fetch('./api/media-ready',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}));
  if(!state.ready)for(const work of list)work.signedPreview=true;
 }
 return list;
}

const capturePatchKey='shen-photo-capture-patches-v1';
export function capturePatches(){
 try{return JSON.parse(localStorage.getItem(capturePatchKey)||'{}')||{}}catch{return {}}
}
export function saveCapturePatches(patches){localStorage.setItem(capturePatchKey,JSON.stringify(patches))}
export function supplementCapture(photo,patch){
 const result={...photo};
 for(const key of ['camera','iso','shutter','lens'])if(!result[key] && patch?.[key])result[key]=patch[key];
 return result;
}
