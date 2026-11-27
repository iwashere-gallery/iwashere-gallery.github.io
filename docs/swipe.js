// A tap still reaches the photo button. Vertical drags stay with the scroll view.
export function installPhotoSwipe(stage,photo,{canSwitch,reduceMotion,change}){
 let gesture=null,ignoreClickUntil=0;
 const passive={passive:true};
 function clear(){
  gesture=null;photo.style.removeProperty('transform');
 }
 stage.addEventListener('touchstart',event=>{
  clear();ignoreClickUntil=0;
  if(event.touches.length!==1||!canSwitch()||(window.visualViewport?.scale||1)>1.01)return;
  const touch=event.touches[0];
  gesture={id:touch.identifier,x:touch.clientX,y:touch.clientY,horizontal:false};
 },passive);
 function track(touch){
  const dx=touch.clientX-gesture.x,dy=touch.clientY-gesture.y;
  if(!gesture.horizontal){
   if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){clear();return}
   if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.35)return;
   gesture.horizontal=true;
  }
  if(!reduceMotion())photo.style.transform='translate3d('+Math.max(-55,Math.min(55,dx*.22))+'px,0,0)';
 }
 stage.addEventListener('touchmove',event=>{
  if(!gesture)return;
  if(event.touches.length!==1){clear();return}
  track(event.touches[0]);
 },passive);
 stage.addEventListener('touchend',event=>{
  if(!gesture)return;
  const touch=Array.from(event.changedTouches).find(item=>item.identifier===gesture.id);
  if(!touch||event.touches.length){clear();return}
  track(touch);
  if(!gesture)return;
  const dx=touch.clientX-gesture.x;
  const commit=gesture.horizontal&&Math.abs(dx)>=Math.min(72,Math.max(34,stage.clientWidth*.12));
  if(gesture.horizontal)ignoreClickUntil=performance.now()+650;
  clear();
  if(commit&&canSwitch())change(dx<0?1:-1);
 },passive);
 stage.addEventListener('touchcancel',clear,passive);
 stage.addEventListener('click',event=>{
  if(event.detail&&performance.now()<ignoreClickUntil){event.preventDefault();event.stopImmediatePropagation()}
 },true);
}
