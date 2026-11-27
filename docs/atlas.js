import {cityKey,normalizePlace,cityZhName,countryName} from './places.js';

const rad=Math.PI/180;
const limit=(value,min,max)=>Math.min(max,Math.max(min,value));
function vector(lon,lat){
 const latitude=lat*rad,longitude=lon*rad;
 return [Math.cos(latitude)*Math.sin(longitude),Math.sin(latitude),Math.cos(latitude)*Math.cos(longitude)];
}

export function createAtlas(){
 const section=document.getElementById('atlas'),canvas=document.getElementById('atlasCanvas');
 const ctx=canvas.getContext('2d'),tip=document.getElementById('atlasTip');
 const directory=document.getElementById('atlasCities'),zoomButton=document.getElementById('atlasZoom'),spinButton=document.getElementById('atlasSpin');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let places=[],land=[],landRequest,lang='en',visible=false,onscreen=false,paused=reduce.matches;
 let lon=-8*rad,lat=34*rad,zoom=1,targetZoom=1,targetLon=lon,targetLat=lat;
 let width=1,height=1,dpr=1,frame=0,last=0,active=null,pointer=null,drag=null;
 const graticule=[];
 for(let y=-60;y<=60;y+=30)graticule.push(Array.from({length:121},(_,i)=>vector(i*3-180,y)));
 for(let x=-180;x<180;x+=30)graticule.push(Array.from({length:61},(_,i)=>vector(x,i*3-90)));
 const tr=(zh,en)=>lang==='zh'?zh:en;
 const name=p=>(lang==='zh'?p.zh:p.en)||p.en||p.zh;
 function setPlaces(groups,cities){
  const coordinates=new Map();
  for(const [city,cc,y,x] of cities){
   for(const alias of [city,cityZhName(city)].filter(Boolean))coordinates.set(cc+'/'+normalizePlace(alias),[x,y]);
  }
  const pins=new Map();
  for(const [cc,photos] of groups)for(const p of photos){
   const city=cityKey(p),key=cc+'/'+city,location=coordinates.get(key);
   if(!location||pins.has(key))continue;
   pins.set(key,{key,cc,zh:p.cityZh||cityZhName(p.cityEn),en:p.cityEn||p.cityZh,
    url:'#place/'+cc+'/'+encodeURIComponent(city),v:vector(...location),lon:location[0]*rad,lat:location[1]*rad});
  }
  places=[...pins.values()];setActive(null);
 }
 function labels(){
  zoomButton.textContent=targetZoom>1?'−':'+';
  const zoomLabel=targetZoom>1?tr('查看整个地球','Show whole globe'):tr('放大地球','Zoom in');
  zoomButton.title=zoomButton.ariaLabel=zoomLabel;
  spinButton.textContent=paused?'▷':'Ⅱ';
  spinButton.title=spinButton.ariaLabel=paused?tr('继续自转','Resume rotation'):tr('暂停自转','Pause rotation');
  spinButton.setAttribute('aria-pressed',String(paused));
 }
 function show(home,language){
  lang=language;visible=home&&places.length>0;section.hidden=!visible;
  if(!visible){pointer=null;drag=null;setActive(null);return}
  document.getElementById('atlasTitle').textContent=tr('拍摄足迹','Photo atlas');
  document.getElementById('atlasHelp').textContent=tr('轻点地球放大，拖动旋转。选择城市，查看照片。','Tap the globe to zoom and drag to rotate. Select a city to see its photographs.');
  directory.replaceChildren();
  for(const p of places.slice().sort((a,b)=>name(a).localeCompare(name(b),lang))){
   const a=document.createElement('a'),country=document.createElement('small');
   a.href=p.url;a.append(name(p));country.textContent=countryName(p.cc,lang);a.append(country);p.link=a;
   const locate=()=>{pointer=null;targetLon=p.lon;targetLat=p.lat;setActive(p);wake()};
   a.addEventListener('focus',locate);a.addEventListener('blur',()=>{setActive(null);wake()});
   a.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')locate()});
   a.addEventListener('pointerleave',()=>{if(document.activeElement!==a){setActive(null);wake()}});
   directory.append(a);
  }
  labels();resize();
 }
 function setActive(pin){
  if(active!==pin){active?.link?.classList.remove('is-near');active=pin;active?.link?.classList.add('is-near')}
  canvas.classList.toggle('has-pin',!!pin);tip.hidden=!pin;
  if(pin)tip.textContent=name(pin);
 }
 function wake(){if(visible&&onscreen&&!document.hidden&&!frame)frame=requestAnimationFrame(draw)}
 function resize(){
  const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;
  width=box.width;height=box.height;dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);wake();
 }
 function radius(){return Math.min(width*.47,height*.45)*zoom}
 function draw(now){
  frame=0;if(!ctx||!visible||!onscreen||document.hidden){last=0;return}
  const dt=last?Math.min((now-last)/1000,.05):0;last=now;
  const norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const moving=Math.abs(norm(targetLon-lon))+Math.abs(targetLat-lat)+Math.abs(targetZoom-zoom)>.001;
  const spin=!paused&&!active&&!drag&&targetZoom===1;
  if(spin)targetLon+=dt*.080;
  const mix=reduce.matches||drag?1:1-Math.exp(-12*dt);
  lon+=norm(targetLon-lon)*mix;lat+=(targetLat-lat)*mix;zoom+=(targetZoom-zoom)*mix;
  const r=radius(),cx=width/2,cy=height*.48;
  const sy=Math.sin(lon),cyaw=Math.cos(lon),sp=Math.sin(lat),cp=Math.cos(lat);
  function project(v){
   const ahead=v[0]*sy+v[2]*cyaw;
   return [cx+r*(v[0]*cyaw-v[2]*sy),cy-r*(v[1]*cp-ahead*sp),v[1]*sp+ahead*cp];
  }
  const dark=document.documentElement.dataset.theme==='dark';
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.save();
  ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.clip();
  const fill=ctx.createRadialGradient(cx-r*.34,cy-r*.4,0,cx,cy,r);
  fill.addColorStop(0,dark?'#1b2730':'#f5f7f6');fill.addColorStop(.84,dark?'#101920':'#e4e9e8');fill.addColorStop(1,dark?'#19232a':'#d5dddd');
  ctx.fillStyle=fill;ctx.fillRect(0,0,width,height);
  ctx.strokeStyle=dark?'#afc3c921':'#55696d22';ctx.lineWidth=.65;ctx.beginPath();
  for(const line of graticule){
   let pen=false;
   for(const v of line){const [x,y,z]=project(v);if(z<=0){pen=false;continue}if(pen)ctx.lineTo(x,y);else ctx.moveTo(x,y);pen=true}
  }
  ctx.stroke();ctx.fillStyle=dark?'#a8bcc5':'#64787c';ctx.beginPath();
  for(const v of land){
   const [x,y,z]=project(v);
   if(z<=0||x<0||x>width||y<0||y>height)continue;
   const dot=limit(r*.0045,.55,1.85)*(.48+.52*z);ctx.moveTo(x+dot,y);ctx.arc(x,y,dot,0,Math.PI*2);
  }
  ctx.fill();ctx.restore();
  ctx.strokeStyle=dark?'#b0c5ce55':'#6c80834d';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.stroke();
  for(const p of places){const [x,y,z]=project(p.v);p.x=x;p.y=y;p.front=z>.04&&x>2&&x<width-2&&y>2&&y<height-2}
  if(pointer&&!drag)setActive(nearest(pointer));
  for(const p of places){
   if(!p.front)continue;
   const hot=p===active,at=hot&&pointer?pointer:p;
   const x=p.x+(at.x-p.x)*.15,y=p.y+(at.y-p.y)*.15;
   const size=hot?6.5:4;
   ctx.fillStyle=dark?'#f7fafc':'#182b31';ctx.strokeStyle=dark?'#131b21':'#fafcfb';ctx.lineWidth=1.6;
   ctx.beginPath();ctx.arc(x,y,size,0,2*Math.PI);ctx.fill();ctx.stroke();
   if(!hot){
    ctx.strokeStyle=dark?'#e5edf1aa':'#293c4690';ctx.lineWidth=.85;
    ctx.beginPath();ctx.arc(x,y,size+2.6,0,2*Math.PI);ctx.stroke();
   }
   if(hot){ctx.strokeStyle=dark?'#e1eaed':'#30484e';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,size+3.4,0,2*Math.PI);ctx.stroke();
    tip.style.left=limit(x,52,width-52)+'px';tip.style.top=Math.max(32,y-14)+'px'}
  }
  if(active)tip.hidden=!active.front;
  if(spin||moving||drag)wake();else last=0;
 }
 function nearest(pt){
  let best=null,distance=pt.touch?22:15;
  for(const p of places){const d=Math.hypot(pt.x-p.x,pt.y-p.y);if(p.front&&d<distance){best=p;distance=d}}
  return best;
 }
 function point(e){const b=canvas.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top,touch:e.pointerType!=='mouse'}}
 function toggleZoom(pt){
  if(targetZoom===1){
   const x=(pt.x-width/2)/radius(),y=(height*.48-pt.y)/radius(),q=x*x+y*y;
   if(q>1)return;
   const z=Math.sqrt(1-q);
   targetLat=Math.asin(limit(y*Math.cos(lat)+z*Math.sin(lat),-1,1));
   targetLon=lon+Math.atan2(x,z*Math.cos(lat)-y*Math.sin(lat));targetZoom=2.7;
  }else targetZoom=1;
  canvas.classList.toggle('is-zoomed',targetZoom>1);pointer=null;setActive(null);labels();wake();
 }
 zoomButton.onclick=()=>toggleZoom({x:width/2,y:height*.48});
 spinButton.onclick=()=>{paused=!paused;if(!paused&&targetZoom>1)toggleZoom({x:width/2,y:height*.48});labels();wake()};
 canvas.onpointerdown=e=>{
  if(!e.isPrimary||e.button!==0)return;const pt=point(e);
  drag={id:e.pointerId,start:pt,lon,lat,moved:false};canvas.setPointerCapture(e.pointerId);
 };
 canvas.onpointermove=e=>{
  const pt=point(e);
  if(drag&&drag.id===e.pointerId){
   const dx=pt.x-drag.start.x,dy=pt.y-drag.start.y;
   if(Math.hypot(dx,dy)>5)drag.moved=true;
   if(drag.moved){pointer=null;setActive(null);targetLon=drag.lon-dx/radius();targetLat=limit(drag.lat+dy/radius(),-1.47,1.47);wake()}
  }else if(e.pointerType==='mouse'){pointer=pt;setActive(nearest(pt));wake()}
 };
 canvas.onpointerup=e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const moved=drag.moved,pt=point(e);drag=null;
  if(!moved){const p=nearest(pt);if(p){location.hash=p.url;return}toggleZoom(pt)}
  wake();
 };
 canvas.onpointercancel=()=>{drag=null;pointer=null;setActive(null);wake()};
 canvas.onpointerleave=()=>{if(!drag){pointer=null;setActive(null);wake()}};
 new ResizeObserver(resize).observe(canvas);
 new IntersectionObserver(([entry])=>{
  onscreen=entry.isIntersecting;
  if(onscreen&&!land.length&&!landRequest){
   // Land mask sampled from Natural Earth country polygons in the QGIS world map.
   landRequest=fetch('./land-dots.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(coords=>{
    for(let i=0;i<coords.length;i+=2)land.push(vector(coords[i]/100,coords[i+1]/100));wake()
   }).catch(()=>{landRequest=null});
  }
  if(onscreen){last=0;wake()}
 }).observe(canvas);
 new MutationObserver(wake).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 document.addEventListener('visibilitychange',()=>{last=0;wake()});
 reduce.addEventListener('change',()=>{paused=reduce.matches;labels();wake()});
 return {setPlaces,show};
}
