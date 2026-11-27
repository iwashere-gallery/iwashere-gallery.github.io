const cityNames = {
 Eastbourne:'伊斯特本',
 'Grindavík':'格林达维克',
 'Höfn':'赫本',
 'Reykjavík':'雷克雅未克',
 'Hellissandur':'海德利桑德',
 'Grundarfjörður':'格伦达菲厄泽',
 'Arnarstapi':'阿尔纳斯塔皮',
 'Vík í Mýrdal':'维克',
Rome:'罗马', Milan:'米兰', Paris:'巴黎', London:'伦敦', Cambridge:'剑桥', Shanghai:'上海', Beijing:'北京', Yinchuan:'银川', Zermatt:'采尔马特', Venice:'威尼斯', Florence:'佛罗伦萨', Naples:'那不勒斯', Tokyo:'东京', Kyoto:'京都', Berlin:'柏林', Madrid:'马德里', Barcelona:'巴塞罗那', Zurich:'苏黎世', Geneva:'日内瓦', Edinburgh:'爱丁堡', Manchester:'曼彻斯特', Amsterdam:'阿姆斯特丹', Lyon:'里昂', Nice:'尼斯'};
export const normalizePlace = value => String(value || '').trim().normalize('NFKC').toLowerCase();
export function countryName(code,lang){
 if (!code) return lang==='zh'?'待归档':'Unfiled';
 try {return new Intl.DisplayNames([lang],{type:'region'}).of(code)} catch {return code}
}
let cityRequest;
export function loadCities(){
 if(!cityRequest) cityRequest=fetch('./cities.json').then(r=>{if(!r.ok)throw Error('City directory unavailable');return r.json()}).catch(e=>{cityRequest=null;throw e});
 return cityRequest;
}
export function cityZhName(name){return cityNames[name] || ''}
export function buildCityIndex(rows){
 const index=new Map();
 for(const [name,cc] of rows){
  for(const alias of [name,cityZhName(name)].filter(Boolean)){
   const key=normalizePlace(alias);
   if(!index.has(key))index.set(key,cc);
   else if(index.get(key)!==cc)index.set(key,'');
  }
 }
 return index;
}
export function countryOf(p,index){
 if(/^[A-Z]{2}$/.test(p.country||''))return p.country;
 return index.get(normalizePlace(p.cityEn))||index.get(normalizePlace(p.cityZh))||'';
}
export function cityKey(p){
 const name=p.cityEn || Object.keys(cityNames).find(en=>cityNames[en]===p.cityZh) || p.cityZh;
 return normalizePlace(name);
}

