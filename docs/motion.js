// Only gestures create sound. Movement and pointer hover are always silent.
export function installSound(){
 const toggles=document.querySelectorAll('button.sound-control');
 let enabled=localStorage.getItem('gallery-sound')!=='off';
 const voices=[];
 let lastTone=-Infinity,voiceIndex=0,note=0;
 const intervals=[0,3,7,5,2,5,3,7];
 const sample=new Audio('./bell.wav');
 sample.preload='auto';sample.load();
 function sync(){
  const zh=document.documentElement.lang.startsWith('zh');
  for(const toggle of toggles){
   toggle.setAttribute('aria-pressed',String(enabled));
   toggle.querySelector('.sound-name').textContent=enabled?(zh?'声音开':'Sound on'):(zh?'声音关':'Sound off');
   toggle.title=enabled?(zh?'关闭交互音效':'Mute interaction sounds'):(zh?'开启交互音效':'Enable interaction sounds');
  }
 }
 sync();new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 const pitches={tap:1,open:1.03,close:.96,next:1.06,prev:.98,info:1.08,download:1.11,shutter:1.02,save:1.05};
 function play(kind){
  if(!enabled)return;
  const now=performance.now();
  note=now-lastTone>900?0:(note+1)%intervals.length;
  lastTone=now;
  const voice=voices.length<4?sample.cloneNode():voices[voiceIndex++%voices.length];
  if(voices.length<4)voices.push(voice);
  voice.pause();voice.currentTime=0;voice.preservesPitch=false;
  voice.playbackRate=(pitches[kind]||1)*2**(intervals[note]/12);
  voice.volume=note===0?.39:.30;
  voice.play().catch(()=>{});
 }
 function apply(value){
  enabled=value;sync();
  if(!enabled)voices.forEach(voice=>voice.pause());
 }
 for(const toggle of toggles)toggle.addEventListener('click',()=>{
  apply(!enabled);localStorage.setItem('gallery-sound',enabled?'on':'off');
  if(enabled)play('info');
 });
 function restore(){apply(localStorage.getItem('gallery-sound')!=='off')}
 window.addEventListener('pageshow',restore);
 window.addEventListener('storage',event=>{if(event.key==='gallery-sound'||event.key===null)restore()});
 document.addEventListener('click',event=>{
  const target=event.target;
  const control=target.closest('button,a[href],summary');
  if(!control){
   // A label forwards its click to the associated input.
   const input=target.closest('label')?.control;
   if(input&&!input.disabled&&target!==input&&!input.contains(target))return;
   play(target.closest('.hero')?'shutter':'tap');
   return;
  }
  if(control.matches('.sound-control'))return;
  play(control.dataset.tone||({back:'close',next:'next',prev:'prev',info:'info',download:'download',save:'save',publish:'save',pluck:'shutter'})[control.id]||(control.classList.contains('card')?'open':'tap'));
 });
 return play;
}

export function installAppearance(){
 const root=document.documentElement,themeButton=document.getElementById('theme');
 const canvas=document.getElementById('drape'),control=document.getElementById('pause');
 const systemTheme=matchMedia('(prefers-color-scheme: dark)');
 let choice=localStorage.getItem('gallery-theme');
 const darkInk=['#263942','#233c49','#354455','#314c4e','#354d49','#4e4956'];
 const paleInk=['#aecdda','#849bc3','#b8cde4','#b4bad8','#a5b7da','#bfd2e5'];
 const finishes=[
  {name:['雾银蓝','Silver blue'],colors:['#889fb4','#a2b5c5','#9dacbb','#b6c1c7','#a5adb9','#8995a6']},
  {name:['青瓷灰','Celadon'],colors:['#809a95','#9aafa4','#a8b8ae','#bac2b4','#a0afa9','#899da2']},
  {name:['暮紫灰','Muted violet'],colors:['#9293ac','#a4a2b9','#b8afc1','#b9b1b9','#aaa6b7','#979aaf']}
 ];
 const lightFinishes=[
  {name:finishes[0].name,colors:['#3a536b','#45657e','#52748c','#637f91','#536c84','#4b647e'],glow:finishes[0].colors},
  {name:finishes[1].name,colors:['#395b56','#456a61','#52776a','#627e70','#526e65','#486361'],glow:finishes[1].colors},
  {name:finishes[2].name,colors:['#504d68','#615b78','#716984','#80758b','#74697d','#615d73'],glow:finishes[2].colors}
 ];
 const paletteButton=document.getElementById('palette');
 let finish=Number(localStorage.getItem('gallery-glow'))||0;
 if(!finishes[finish])finish=0;
 // Stored light palettes are numbered from 1. The retired palette used 0.
 let lightFinish=Number(localStorage.getItem('gallery-light-glow'))-1;
 if(!lightFinishes[lightFinish])lightFinish=0;
 let palette=darkInk;
 function setTheme(){
  const dark=choice?choice==='dark':systemTheme.matches;
  root.dataset.theme=dark?'dark':'light';palette=dark?paleInk:darkInk;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=dark?'#000000':'#f1f3ef';
  const zh=root.lang.startsWith('zh');
  if(paletteButton){
   paletteButton.hidden=false;
   const current=dark?finishes[finish]:lightFinishes[lightFinish];
   paletteButton.textContent=current.name[zh?0:1];
   paletteButton.title=(zh?'切换光晕配色 · ':'Cycle glow colour · ')+paletteButton.textContent;
   paletteButton.setAttribute('aria-label',paletteButton.title);
  }
  themeButton.querySelector('.theme-glyph').textContent=dark?'☾':'☼';
  themeButton.querySelector('.theme-name').textContent=dark?(zh?'深色':'Dark'):(zh?'浅色':'Light');
  themeButton.setAttribute('aria-label',dark?(zh?'切换到浅色模式':'Switch to light mode'):(zh?'切换到深色模式':'Switch to dark mode'));
  themeButton.setAttribute('aria-pressed',String(dark));
 }
 themeButton.onclick=()=>{choice=root.dataset.theme==='dark'?'light':'dark';localStorage.setItem('gallery-theme',choice);setTheme();if(ctx)draw()};
 systemTheme.addEventListener('change',()=>{if(!choice){setTheme();if(ctx)draw()}});
 new MutationObserver(setTheme).observe(root,{attributes:true,attributeFilter:['lang']});setTheme();

 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let manualPause=localStorage.getItem('gallery-drape-paused')==='yes',visible=true;
 let w=1,h=1,scale=1,time=0,last=0,frame=0,px=.63,py=.52,targetX=px,targetY=py,pull=0,targetPull=0;
 let pulse={x:.6,y:.5,start:-10};
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx){control.hidden=true;return}
 // Bake each halo once. Only the compressed folds need soft light.
 function bakeHalos(colors){return colors.map(color=>{
  const tile=document.createElement('canvas');tile.width=tile.height=40;
  const g=tile.getContext('2d'),gradient=g.createRadialGradient(20,20,0,20,20,20);
  gradient.addColorStop(0,color+'e0');gradient.addColorStop(.22,color+'88');gradient.addColorStop(.56,color+'30');gradient.addColorStop(1,color+'00');
  g.fillStyle=gradient;g.fillRect(0,0,40,40);return tile;
 })}
 const daytimeHalos=lightFinishes.map(f=>bakeHalos(f.glow));
 const nightHalos=finishes.map(f=>bakeHalos(f.colors));
 if(paletteButton)paletteButton.onclick=()=>{
  if(root.dataset.theme==='dark'){
   finish=(finish+1)%finishes.length;localStorage.setItem('gallery-glow',String(finish));
  }else{
   lightFinish=(lightFinish+1)%lightFinishes.length;localStorage.setItem('gallery-light-glow',String(lightFinish+1));
  }
  setTheme();draw();
 };
 let cols=0,rows=0,previousY=new Float32Array(0);
 function paused(){return manualPause||reduce.matches}
 function sync(){
  const zh=document.documentElement.lang.startsWith('zh');const stopped=paused();
  control.textContent=stopped?'▶':'Ⅱ';control.title=stopped?(zh?'播放背景动画':'Play curtain'):(zh?'暂停背景动画':'Pause curtain');control.setAttribute('aria-label',control.title);control.disabled=reduce.matches;
 }
 function draw(){
  ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,w,h);
  const age=time-pulse.start, ripple=age>=0&&age<1.7;
  const dark=palette===paleInk;
  const spectrum=dark?finishes[finish].colors:lightFinishes[lightFinish].colors;
  const halos=dark?nightHalos[finish]:daytimeHalos[lightFinish];
  for(let row=0;row<rows;row++){
   const v=row/(rows-1),phase=v*3.6,fold=Math.sin(phase+time*.43);
   const ink=(.5+.5*Math.sin(phase*1.65+time*.36))*(palette.length-1);
   const rowInk=palette[Math.round(ink)];
   const rowAlpha=(dark ? .19 : .25)+.41*Math.pow(.5+.5*fold,1.3);
   const dot=.9+v*.95;
   for(let col=0;col<cols;col++){
    const u=col/(cols-1)*1.08-.04;
    const x=u+.025*Math.sin(phase+u*5+time*.48);
    const y=.51+(v-.5)*(1.03+.24*Math.sin(u*6-time*.48))+.175*Math.sin(u*6.8+phase*.8-time*.74)+.10*Math.cos(u*10.4-phase*.55+time*.55);
    const dx=x-px,dy=y-py;let displacement=pull*.115/(1+22*dx*dx+32*dy*dy);
    if(ripple){const d=Math.hypot((x-pulse.x)*w/h,y-pulse.y),front=d-age*.66;
     displacement+=.082*Math.exp(-front*front*95-age*1.8)*Math.cos(front*25)}
    const finalY=y+displacement;
    const spacing=Math.abs(finalY-previousY[col])*(rows-1);
    previousY[col]=finalY;
    const compression=row===0?0:Math.min(1,Math.max(0,(.97-spacing)/.63));
    const strength=compression*compression*(3-2*compression);
    if(strength>.08){
     const hue=Math.round((.5+.5*Math.sin(u*5.6+v*3.3-time*.46))*(spectrum.length-1));
     if(row%2===0&&col%3===0){
      const radius=Math.min(20,Math.max(9,w/cols*1.9));
      ctx.globalAlpha=strength*(dark?.21:.24);
      ctx.drawImage(halos[hue],x*w-radius,finalY*h-radius,2*radius,2*radius);
     }
     ctx.fillStyle=spectrum[hue];
     ctx.globalAlpha=Math.min(1,rowAlpha+strength*.37);
    }else{ctx.fillStyle=rowInk;ctx.globalAlpha=rowAlpha}
    ctx.fillRect(x*w,finalY*h,dot+strength*.7,dot+strength*.7);
   }
  }
  ctx.globalAlpha=1;
 }
 function tick(now){
  frame=0;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;time+=dt;
  const blend=1-Math.exp(-dt*10);px+=(targetX-px)*blend;py+=(targetY-py)*blend;pull+=(targetPull-pull)*blend;
  draw();schedule();
 }
 function schedule(){
  if(!paused()&&visible&&!document.hidden){if(!frame)frame=requestAnimationFrame(tick)}
  else{if(frame)cancelAnimationFrame(frame);frame=0;last=0}
 }
 function resize(){
  const rect=canvas.getBoundingClientRect();w=Math.max(1,rect.width);h=Math.max(1,rect.height);scale=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
  cols=Math.max(64,Math.min(165,Math.ceil(w/7)));rows=w<650?30:46;previousY=new Float32Array(cols);draw();schedule();
 }
 function point(event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)/w,y:(event.clientY-rect.top)/h}}
 document.addEventListener('pointermove',event=>{const p=point(event);targetX=p.x;targetY=p.y;targetPull=1});
 function relax(){targetPull=0}
 document.addEventListener('pointerleave',relax);document.addEventListener('pointercancel',relax);document.addEventListener('pointerup',e=>{if(e.pointerType==='touch')relax()});
 document.addEventListener('click',e=>{pulse={...(e.detail?point(e):{x:.65,y:.5}),start:time};if(!paused())schedule()});
 control.onclick=()=>{manualPause=!manualPause;localStorage.setItem('gallery-drape-paused',manualPause?'yes':'no');sync();schedule()};
 reduce.addEventListener('change',()=>{sync();if(paused())draw();schedule()});document.addEventListener('visibilitychange',schedule);
 new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule()}).observe(canvas);
 new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 new ResizeObserver(resize).observe(canvas);sync();resize();
}
