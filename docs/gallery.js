import {installPhotoSwipe} from './swipe.js';
import {serviceURL} from './service.js';
import {recordDownload} from './downloads.js';
import {startGuestbook} from './guestbook.js';
import {createAtlas} from './atlas.js';
import {mountRail} from './rail.js';
import {buildCityIndex,loadCities,countryName,countryOf,cityKey} from './places.js';
import {installSound,installAppearance} from './motion.js';
import {el,language,phrase,titleOf,photoHash,commentsHash,cityOf,dbOp,draftImage,readGallery,displayLens,capturePatches,supplementCapture} from './common.js';
const labels={
 introOpening:['2025 年 12 月，我开始对摄影产生兴趣。走到哪儿，就拍到哪儿。有时是一座第一次到访的城市，有时只是熟悉街角里的一束光。','I first got interested in photography in December 2025. These days, I take photos wherever I go. Sometimes it’s a city I’m visiting for the first time. Sometimes it’s the light on a familiar street corner.'],
 introWelcome:['我会不定期把新照片放在这里。希望你能找到喜欢的画面，也希望下次你再来时，能从新照片里，看见我一点点的进步。','I’ll add new photographs here from time to time. I hope you find a few you love, and that each time you come back, you can see how I’m growing as a photographer.'],
 openSigned:['打开签名图','Open signed JPEG'],destinations:['目的地','Destinations'],heading:['我在场','I Was Here'],studio:['作品管理','Studio'],empty:['第一张作品将在这里展出。','The first photograph will appear here.'],close:['关闭','Close'],info:['拍摄信息','Photo info'],download:['下载签名照片','Download signed photo']};
let all=[],list=[],index=0,catalog=new Map(),countries=new Map(),stopRail=()=>{};
let displayedId=null;
const covers=new Map();
const atlas=createAtlas();
const book=startGuestbook();
function localWork(work){
 return {...work,preview:URL.createObjectURL(work.previewBlob),signed:work.signedBlob&&URL.createObjectURL(work.signedBlob)};
}
async function loadDraftImages(work){
 if(!work.separateImages||work.loadingImages||work.signed&&work.detail)return;
 work.loadingImages=true;
 try{
  for(const kind of ['detail','signed']){
   if(!work[kind])work[kind]=URL.createObjectURL(await draftImage(work,kind));
  }
 }finally{
  work.loadingImages=false;
  if(viewer.open&&displayedId===work.id)drawDetail();
 }
}
function grouped(items,keyOf){
 const groups=new Map();
 for(const item of items){const key=keyOf(item);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}
 return groups;
}
async function refresh(){
 try{
  const [remote,local,cities]=await Promise.all([readGallery(),dbOp('getAll').catch(()=>[]),loadCities().catch(()=>[])]);
  const drafts=local.filter(p=>!remote.some(r=>r.id===p.id)).sort((a,b)=>b.created-a.created).map(localWork);
  const patches=capturePatches();
  all=[...drafts,...remote.map(p=>supplementCapture(p,patches[p.id]))];
  covers.clear();if(viewer.open&&!all.some(w=>w.id===displayedId))viewer.close();
  catalog=buildCityIndex(cities);countries=grouped(all,p=>countryOf(p,catalog));atlas.setPlaces(countries,cities);render();
 }catch{el('empty').hidden=false;el('empty').textContent=phrase('作品列表加载失败，请刷新。','Unable to load photographs. Please reload.')}
}
function coverFor(key,photos){
 if(!covers.has(key))covers.set(key,photos[Math.floor(Math.random()*photos.length)]);
 return covers.get(key);
}
function makeLink(hash,label){
 const a=document.createElement('a');a.href=hash;a.textContent=label;return a;
}
function sizePhotoCard(card,image,photo){
 function apply(width,height){
  image.width=width;image.height=height;
  card.style.setProperty('--photo-ratio',String(width/height));
 }
 if(photo.previewWidth>0 && photo.previewHeight>0)apply(photo.previewWidth,photo.previewHeight);
 else image.addEventListener('load',()=>apply(image.naturalWidth,image.naturalHeight),{once:true});
}
function placeCard(label,photo,hash,hero){
 const a=makeLink(hash,''),im=document.createElement('img'),name=document.createElement('strong');
 a.className=hero?'destination-card':'card city-card';a.dataset.tone='open';
 if(!hero)sizePhotoCard(a,im,photo);
 im.src=photo.preview;im.alt='';im.draggable=false;a.draggable=false;name.textContent=label;a.append(im,name);return a;
}
const cityLabel=photos=>cityOf(photos.find(p=>language()==='zh'?p.cityZh:p.cityEn)||photos[0])||phrase('城市未标注','City unspecified');
function photoCard(p,i){
 const b=document.createElement('button'),im=document.createElement('img'),title=document.createElement('strong');
 sizePhotoCard(b,im,p);
 b.className='card';im.loading='lazy';im.src=p.preview;im.alt='';title.textContent=titleOf(p);b.append(im,title);
 b.onclick=()=>openPhoto(i);
 return b;
}
function openPhoto(i){
 index=i;drawDetail();book.open(list[i]);loadDraftImages(list[i]).catch(console.error);
 if(!viewer.open){viewer.showModal();el('workTitle').focus({preventScroll:true})}
 viewer.scrollTop=0;
 animate(el('large'),[{opacity:.3,transform:'scale(.95)'},{opacity:1,transform:'none'}],330);
}
function cityHash(work){
 return '#place/'+(countryOf(work,catalog)||'_')+'/'+encodeURIComponent(cityKey(work));
}
function drawDetail(){
 const p=list[index];if(!p)return;
 displayedId=p.id;
 updateViewLabel();
 el('viewerBackdrop').src=p.preview;
 const large=el('large'),source=p.detail||p.preview;
 if(large.dataset.source!==source){
  large.dataset.source=source;large.src=p.preview;
  if(p.detail){
   const hd=new Image();hd.src=p.detail;
   hd.decode().then(()=>{if(large.dataset.source===source)large.src=source}).catch(()=>{});
  }
 }
 large.alt=titleOf(p);el('workTitle').textContent=titleOf(p);
 el('description').textContent=(language()==='zh'?p.noteZh||p.noteEn:p.noteEn||p.noteZh)||'';
 const download=el('download'),openSigned=el('openSigned');
 download.parentElement.hidden=!p.signed;
 download.textContent=p.signedPreview?phrase('下载签名预览图','Download signed preview'):phrase('下载签名照片','Download signed photo');
 if(p.signed){
  openSigned.href=p.signed;
  download.href=p.signed;
  download.download='LiwangxuShen-'+p.id+'.jpg';
  download.onclick=p.signed.startsWith('blob:')?null:()=>recordDownload(p.id);
 }

 el('position').textContent=(index+1)+' / '+list.length;
 const focal=p.focal && p.focal+' mm'+(p.focalEquivalent?phrase('（等效）',' equiv.'):'');
 const shutter=(p.shutter||'—')+' s';
 const settings=[focal,p.aperture && 'ƒ/'+p.aperture,shutter,'ISO '+(p.iso||phrase('待补全','unavailable'))];
 const context=[p.taken?.replace('T',' '),cityOf(p)];
 for(const [id,value] of [['camera',p.camera||phrase('设备待补全','Camera unavailable')],['lens',displayLens(p.camera,p.lens)],['settings',settings.filter(Boolean).join('　')],['context',context.filter(Boolean).join(' · ')]]){
  el(id).textContent=value||'';el(id).hidden=!value;
 }
 el('prev').disabled=el('next').disabled=list.length<2;el('prev').ariaLabel=phrase('上一张','Previous');el('next').ariaLabel=phrase('下一张','Next');
}
function renderSlots(parts){
 const level=parts[0]==='layout' && ['cities','photos'].includes(parts[1])?parts[1]:'home';
 const home=level==='home', city=level==='cities';
 const label=home?phrase('目的地','Destinations'):city?phrase('城市','Cities'):phrase('作品','Photographs');
 const rail=el('rail'),grid=el('grid'),crumbs=el('crumbs');
 grid.classList.remove('photo-grid');
 document.querySelector('.hero').hidden=!home;
 rail.hidden=!home;grid.hidden=home;el('empty').hidden=true;
 el('sectionTitle').textContent=label;el('count').textContent='';
 crumbs.hidden=home;crumbs.replaceChildren();grid.replaceChildren();
 if(!home){
  crumbs.append(makeLink('#collection',phrase('全部目的地','All destinations')));
  if(!city)crumbs.append(makeLink('#layout/cities',phrase('城市','Cities')));
 }
 function slot(i){
  const next=home?'#layout/cities':city?'#layout/photos':'';
  const tile=next?makeLink(next,''):document.createElement('div');
  tile.className=(home?'destination-card ':'')+'reserved-slot';
  tile.draggable=false;
  if(next)tile.setAttribute('aria-label',label+' '+(i+1));else tile.setAttribute('aria-hidden','true');
  return tile;
 }
 if(home)stopRail=mountRail(rail,[0,1,2,3],slot);
 else grid.append(...[0,1,2].map(slot));
}
function linkedPhoto(){
 return all.find(work=>photoHash(work.id)===location.hash||commentsHash(work.id)===location.hash);
}
function revealGuestbook(){
 const title=el('guestTitle');
 title.focus({preventScroll:true});
 el('guestbook').scrollIntoView({block:'start',behavior:'instant'});
}
function render(){
 book.labels();
 stopRail();stopRail=()=>{};
 const lang=language();document.documentElement.lang=lang==='zh'?'zh-CN':'en';
 document.title=phrase('我在场','I Was Here')+' · Liwangxu Shen';
 document.querySelectorAll('[data-t]').forEach(n=>n.textContent=phrase(...labels[n.dataset.t]));
 el('lang').textContent=phrase('EN','中文');
 const linked=linkedPhoto();
 const parts=(linked?cityHash(linked):location.hash).slice(1).split('/');
 if(!all.length){atlas.show(false,lang);renderSlots(parts);return}
 const cc=parts[1]==='_'?'':parts[1], country=parts[0]==='place'?countries.get(cc):null;
 const cities=country?grouped(country,cityKey):null;
 let key;try{if(parts.length===3)key=decodeURIComponent(parts[2])}catch{}
 const photos=cities?.get(key),home=!country;
 atlas.show(home,lang);
 const countryPath='#place/'+(cc||'_');
 const grid=el('grid'),rail=el('rail'),crumbs=el('crumbs');
 document.querySelector('.hero').hidden=!home;
 rail.hidden=!home||!all.length;grid.hidden=home;el('empty').hidden=!!all.length;
 grid.classList.toggle('photo-grid',!home);
 grid.replaceChildren();crumbs.replaceChildren();crumbs.hidden=home;
 list=photos||[];index=Math.min(index,Math.max(0,list.length-1));
 if(!home){
  crumbs.setAttribute('aria-label',phrase('导航路径','Breadcrumb'));
  crumbs.append(makeLink('#collection',phrase('全部目的地','All destinations')));
  if(photos)crumbs.append(makeLink(countryPath,countryName(cc,lang)));
 }
 el('sectionTitle').textContent=home?phrase(...labels.destinations):photos?cityLabel(photos):countryName(cc,lang);
 const unassigned=cities?.get('')?.length||0;
 const count=home?countries.size:photos?photos.length:cities.size-Number(unassigned>0);
 const unit=home?phrase(' 个目的地',count===1?' destination':' destinations'):photos?phrase(' 幅作品',count===1?' photograph':' photographs'):phrase(' 座城市',count===1?' city':' cities');
 el('count').textContent=count+unit;
 if(country&&!photos&&unassigned)el('count').append(phrase(' · '+unassigned+' 幅作品待定位',' · '+unassigned+' without a city'));
 if(home&&all.length){
  stopRail=mountRail(rail,[...countries],([code,items])=>placeCard(countryName(code,lang),coverFor(code,items),'#place/'+(code||'_'),true));
 }else if(photos)grid.append(...photos.map(photoCard));
 else if(cities)for(const [city,items] of cities)grid.append(placeCard(cityLabel(items),coverFor(countryPath+'/'+city,items),countryPath+'/'+encodeURIComponent(city),false));
 if(linked&&(!viewer.open||displayedId!==linked.id)){
  openPhoto(list.indexOf(linked));
  if(location.hash===commentsHash(linked.id))revealGuestbook();
 }
 else if(viewer.open)drawDetail();
}
window.addEventListener('hashchange',()=>{
 if(viewer.open&&!linkedPhoto())viewer.close();
 render();
 if(viewer.open&&location.hash===commentsHash(displayedId)){setPure(false);revealGuestbook()}
 if(/^#(place|layout)\//.test(location.hash)){window.scrollTo({top:0,behavior:'instant'});el('sectionTitle').focus({preventScroll:true})}
});
el('lang').onclick=()=>{localStorage.setItem('gallery-language',language()==='zh'?'en':'zh');render()};
el('back').onclick=()=>el('viewer').close();
const viewer=el('viewer'),viewPhoto=el('viewPhoto');
function updateViewLabel(){
 const pure=viewer.classList.contains('pure');
 viewPhoto.setAttribute('aria-pressed',String(pure));
 viewPhoto.setAttribute('aria-label',pure?phrase('返回拍摄信息','Return to photo details'):phrase('纯看图','View photo only'));
}
function setPure(active){
 viewer.classList.toggle('pure',active);
 el('large').getAnimations().forEach(animation=>animation.cancel());
 viewer.scrollTop=0;updateViewLabel();
}
viewPhoto.onclick=()=>setPure(!viewer.classList.contains('pure'));
viewer.addEventListener('cancel',event=>{
 if(viewer.classList.contains('pure')){event.preventDefault();setPure(false)}
});
viewer.addEventListener('close',()=>{
 if(viewer.open)return;
 displayedId=null;setPure(false);
 const photo=list[index];
 if(photo&&linkedPhoto()?.id===photo.id){
  history.replaceState(null,'',cityHash(photo));
  el('grid').children[index]?.focus({preventScroll:true});
 }
});
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
function animate(element,keyframes,duration=260){
 if(motionQuery.matches||!element.animate)return;
 element.getAnimations().forEach(a=>a.cancel());
 element.animate(keyframes,{duration,easing:'cubic-bezier(.2,.75,.25,1)'});
}
function advance(step){
 if(list.length<2)return;
 index=(index+step+list.length)%list.length;
 if(location.hash.startsWith('#photo/'))history.replaceState(null,'',photoHash(list[index].id));
 drawDetail();book.open(list[index]);loadDraftImages(list[index]).catch(console.error);viewer.scrollTop=0;
 animate(el('large'),[{opacity:.28,transform:'translateX('+step*26+'px) scale(.985)'},{opacity:1,transform:'none'}]);
}
installPhotoSwipe(viewPhoto.closest('.stage'),viewPhoto,{
 canSwitch:()=>viewer.open&&list.length>1,
 reduceMotion:()=>motionQuery.matches,
 change:step=>{play(step>0?'next':'prev');advance(step)}
});
el('next').onclick=()=>advance(1);el('prev').onclick=()=>advance(-1);
document.addEventListener('keydown',e=>{if(!e.target.closest('input,textarea,[contenteditable=true]')&&el('viewer').open&&list.length){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const step=e.key==='ArrowLeft'?-1:1;if(list.length>1)play(step>0?'next':'prev');advance(step)}}});
const play=installSound();
installAppearance();
window.addEventListener('storage',e=>{if(e.key==='gallery-catalog-changed')refresh()});
window.addEventListener('pageshow',e=>{if(e.persisted)refresh()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
// Studio authenticates the owner on its own origin.
el('studioLink').href=serviceURL('studio/page').href;
render();refresh();
