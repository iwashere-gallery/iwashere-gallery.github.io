import {el,phrase as t,language} from './common.js';
import {serviceURL} from './service.js';

export async function api(path,method='GET',data){
 const result=await fetch(serviceURL(path),{method,credentials:'omit',cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
 if(!result.ok){
  const body=await result.json().catch(()=>({}));
  throw Object.assign(Error('Request failed'),{status:result.status,code:body.error});
 }
 return result.json();
}
export function node(tag,words){
 const n=document.createElement(tag);n.textContent=words;return n;
}
function sessionKey(name){
 try{let value=sessionStorage.getItem(name);if(!value){value=crypto.randomUUID();sessionStorage.setItem(name,value)}return value}
 catch{return crypto.randomUUID()}
}
export function messageItem(message){
 const item=document.createElement('li'),heading=document.createElement('div'),date=new Date(message.created);
 const time=node('time',new Intl.DateTimeFormat(language(),{dateStyle:'medium',timeStyle:'short'}).format(date));
 time.dateTime=date.toISOString();
 heading.append(node('strong',message.nickname||t('匿名访客','Guest')),time);
 item.append(heading,node('p',message.body));return item;
}
export function startGuestbook(){
 const guest=sessionKey('guestbook-guest'),visit=sessionKey('gallery-visit'),section=el('guestbook'),form=el('guestForm');
 let photo='',model,visitCount,pending,serial=0,revision=0,busy=false,error='';
 function labels(){
  el('siteVisits').textContent=visitCount==null?'':t('画廊访问 '+visitCount+' 次',visitCount+' gallery '+(visitCount===1?'visit':'visits'));
  el('guestTitle').textContent=t('留言板','Guestbook');
  el('nickLabel').textContent=t('昵称（选填）','Nickname (optional)');
  el('messageLabel').textContent=t('留言','Message');
  el('sendMessage').textContent=t('发表留言','Post message');
  el('olderMessages').textContent=t('更早的留言','Older messages');
  el('guestStats').textContent=model?t(model.views+' 次浏览 · '+model.comments+' 条留言',model.views+(model.views===1?' view':' views')+' · '+model.comments+(model.comments===1?' message':' messages')):'';
  el('messageList').replaceChildren(...(model?.messages||[]).map(messageItem));
  el('olderMessages').hidden=!model?.before;
  el('guestStatus').textContent=error==='rate'?t('请稍等片刻再留言。','Please wait a moment before posting again.'):error?t('暂时无法连接，请重试。','Unable to connect. Please try again.'):'';
 }
 api('visits','POST',{key:visit}).then(v=>{visitCount=v.n;labels()}).catch(()=>{});
 async function revalidate(){
  if(!photo||!el('viewer').open||document.hidden||busy)return;
  const seq=++revision,current=serial;
  try{
   const result=await api('works/'+encodeURIComponent(photo));
   if(seq!==revision||current!==serial||busy)return;
   if(!model||model.comments!==result.comments||model.messages[0]?.id!==result.messages[0]?.id||model.views!==result.views){
    if(model&&model.comments===result.comments&&model.messages[0]?.id===result.messages[0]?.id)model.views=result.views;
    else model=result;
    labels();
   }
  }catch{/* Keep the visible thread and retry when the visitor returns. */}
 }
 window.addEventListener('focus',revalidate);
 window.addEventListener('pageshow',revalidate);
 document.addEventListener('visibilitychange',revalidate);
 window.addEventListener('storage',e=>{
  if(e.key!=='gallery-comment-change')return;
  let change;try{change=JSON.parse(e.newValue)}catch{return}
  if(change?.photo!==photo)return;
  if(model?.messages.some(m=>m.id===change.id)){
   model.messages=model.messages.filter(m=>m.id!==change.id);model.comments--;labels();
  }
  revalidate();
 });
 window.setInterval(revalidate,30000);
 async function open(work){
  const current=++serial,version=++revision;
  photo=work.preview.startsWith('blob:')?'':work.id;
  form.reset();pending=null;busy=false;el('sendMessage').disabled=false;model=null;error='';section.hidden=!photo;labels();
  if(!photo)return;
  try{const result=await api('works/'+encodeURIComponent(photo)+'/view','POST',{key:crypto.randomUUID()});if(current===serial&&version===revision)model=result}
  catch{if(current===serial&&version===revision)error='network'}
  if(current===serial)labels();
 }
 form.onsubmit=async(event)=>{
  event.preventDefault();if(busy||!photo)return;
  const body=el('guestBody').value.trim(),nickname=el('guestNick').value.trim(),current=serial;
  if(!body){el('guestBody').focus();return}
  if(!pending||pending.body!==body||pending.nickname!==nickname)pending={key:crypto.randomUUID(),body,nickname,guest};
  revision++;busy=true;el('sendMessage').disabled=true;
  try{
   const result=await api('works/'+encodeURIComponent(photo)+'/messages','POST',pending);
   if(current!==serial)return;model=result;form.reset();pending=null;error='';
  }catch(e){if(current===serial)error=e.status===429?'rate':'network'}
  finally{if(current===serial){busy=false;el('sendMessage').disabled=false;labels()}}
 };
 el('olderMessages').onclick=async()=>{
  const current=serial,version=revision,button=el('olderMessages'),before=model?.before;if(!before)return;
  button.disabled=true;
  try{const result=await api('works/'+encodeURIComponent(photo)+'?before='+before);
   if(current===serial&&version===revision&&model?.before===before){model={...result,messages:[...model.messages,...result.messages]};error=''}}
  catch{if(current===serial)error='network'}
  finally{button.disabled=false;labels()}
 };
 labels();return {open,labels};
}
