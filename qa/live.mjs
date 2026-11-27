import assert from 'node:assert/strict';
import {serviceURL} from '../docs/service.js';

const origin = 'https://iwashere-gallery.github.io';
const liveCatalog = await fetch(origin+'/gallery.json');
assert.ok(liveCatalog.ok || liveCatalog.status===404,'Live Pages catalog '+liveCatalog.status);
const catalog=liveCatalog.ok?await liveCatalog.json():[{id:'dsc01362'}];
assert.ok(Array.isArray(catalog),'Invalid live Pages catalog');
const work = 'works/'+encodeURIComponent(catalog[0]?.id||'qa-absent-work');
for (const route of ['visits',work+'/view',work+'/messages',work+'/download']) {
 const preflight = await fetch(serviceURL(route), {method:'OPTIONS',headers:{Origin:origin,
  'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
 assert.ok(preflight.ok, route+' preflight '+preflight.status);
 assert.equal(preflight.headers.get('access-control-allow-origin'),origin,route);
}
for (const route of ['visits',work]) {
 const response=await fetch(serviceURL(route),{headers:{Origin:origin}});
 assert.equal(response.status,route===work&&!catalog.length?404:200,route);
 assert.equal(response.headers.get('access-control-allow-origin'),origin);
 if(response.status===404)continue;
 const data=await response.json();
 assert.ok(Number.isInteger(route==='visits'?data.n:data.views),route);
}
