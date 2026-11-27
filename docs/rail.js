export function mountRail(rail, groups, makeCard){
 const controller=new AbortController(), options={signal:controller.signal};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const track=document.createElement('div');
 track.className='travel-track';rail.replaceChildren(track);
 const repeats=groups.length>1?5:1, middle=Math.floor(repeats/2);
 rail.classList.toggle('is-looping',repeats>1);
 const sets=[];
 for(let i=0;i<repeats;i++){
  const set=document.createElement('div');set.className='travel-set';
  if(i!==middle)set.setAttribute('aria-hidden','true');
  groups.forEach(group=>{
   const card=makeCard(group);
   if(i!==middle)card.tabIndex=-1;
   set.append(card);
  });
  sets.push(set);track.append(set);
 }
 let span=0,position=0,last=0,frame=0,drag=null,suppress=false,over=false,keyboard=false;
 let touchActive=false,nativeScroll=false,resumeAfter=0;
 const passive={...options,passive:true};
 const center=()=>middle*span;
 // Let the browser own the entire gesture, including inertial scrolling after release.
 function deferAutoplay(){resumeAfter=performance.now()+2200}
 rail.addEventListener('touchstart',()=>{
  touchActive=true;nativeScroll=true;keyboard=false;over=false;deferAutoplay();
 },passive);
 function touchFinished(e){touchActive=e.touches.length>0;deferAutoplay()}
 rail.addEventListener('touchend',touchFinished,passive);
 rail.addEventListener('touchcancel',touchFinished,passive);
 rail.addEventListener('scroll',()=>{
  if(nativeScroll){position=rail.scrollLeft;deferAutoplay()}
 },passive);
 function move(value){
  if(!span || repeats===1)return;
  position=center()+((value-center())%span+span)%span;
  rail.scrollLeft=position;
 }
 function measure(){
  const old=span,frac=old?(position-center())/old:0;
  span=sets[0].getBoundingClientRect().width;
  if(!nativeScroll&&span!==old)move(center()+frac*span);
 }
 const size=new ResizeObserver(measure);size.observe(sets[0]);measure();
 rail.addEventListener('pointerenter',e=>{over=e.pointerType==='mouse'},options);
 rail.addEventListener('pointerleave',()=>{over=false},options);
 rail.addEventListener('focusin',e=>{keyboard=e.target.matches(':focus-visible');if(keyboard)position=rail.scrollLeft},options);
 rail.addEventListener('focusout',e=>{if(!rail.contains(e.relatedTarget))keyboard=false},options);
 rail.addEventListener('dragstart',e=>e.preventDefault(),options);
 rail.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'||!e.isPrimary||e.button!==0)return;
  nativeScroll=false;
  keyboard=false;suppress=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,start:rail.scrollLeft,moved:false};
 },options);
 window.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.moved){
   if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;
   if(Math.abs(dy)>Math.abs(dx)){drag=null;return}
   drag.moved=true;rail.setPointerCapture(e.pointerId);rail.classList.add('dragging');
  }
  move(drag.start-dx);
 },options);
 function release(e){
  if(!drag||drag.id!==e.pointerId)return;
  suppress=drag.moved;if(rail.hasPointerCapture(e.pointerId))rail.releasePointerCapture(e.pointerId);
  drag=null;rail.classList.remove('dragging');
 }
 window.addEventListener('pointerup',release,options);window.addEventListener('pointercancel',release,options);
 rail.addEventListener('click',e=>{if(suppress&&e.detail){e.preventDefault();e.stopImmediatePropagation();suppress=false}}, {...options,capture:true});
 rail.addEventListener('wheel',e=>{
  if(Math.abs(e.deltaX)>Math.abs(e.deltaY)&&repeats>1){e.preventDefault();move(rail.scrollLeft+e.deltaX)}
 },{...options,passive:false});
 function tick(now){
  const delta=last?Math.min(now-last,50):0;last=now;
  if(nativeScroll&&!touchActive&&now>=resumeAfter){
   position=rail.scrollLeft;nativeScroll=false;
  }
  if(!nativeScroll&&!over&&!drag&&!keyboard&&!document.hidden&&!reduced.matches&&localStorage.getItem('gallery-drape-paused')!=='yes')move(position+delta*.051);
  frame=requestAnimationFrame(tick);
 }
 if(repeats>1)frame=requestAnimationFrame(tick);
 return ()=>{cancelAnimationFrame(frame);size.disconnect();controller.abort()};
}

