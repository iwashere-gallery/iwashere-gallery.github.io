import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {serviceURL} from '../docs/service.js';

const origin = 'https://iwashere-gallery.github.io';
const catalog = JSON.parse(await readFile('docs/gallery.json','utf8'));
const work = 'works/'+encodeURIComponent(catalog[0].id);
for (const route of ['visits',work+'/view',work+'/messages',work+'/download']) {
 const preflight = await fetch(serviceURL(route), {method:'OPTIONS',headers:{Origin:origin,
  'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
 assert.ok(preflight.ok, route+' preflight '+preflight.status);
 assert.equal(preflight.headers.get('access-control-allow-origin'),origin,route);
}
for (const route of ['visits',work]) {
 const response=await fetch(serviceURL(route),{headers:{Origin:origin}});
 assert.equal(response.status,200,route);
 assert.equal(response.headers.get('access-control-allow-origin'),origin);
 const data=await response.json();
 assert.ok(Number.isInteger(route==='visits'?data.n:data.views),route);
}
