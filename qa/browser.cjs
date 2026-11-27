const { chromium } = require('playwright');
const { readFile } = require('node:fs/promises');
const assert = require('node:assert/strict');

(async () => {
 const browser = await chromium.launch();
 try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const catalog = JSON.parse(await readFile('docs/gallery.json', 'utf8'));
  const work = catalog.find(w=>w.id==='dsc01362') || catalog.find(w=>w.country && w.cityEn);
  assert.ok(work,'The fixture requires a published photograph with a city.');
  const country=new Intl.DisplayNames(['en'],{type:'region'}).of(work.country);
  await page.goto('http://127.0.0.1:5186/');
  await page.getByRole('link', {name:country,exact:true}).waitFor();
  assert.equal(await page.locator('#rail').getByRole('link').count(), new Set(catalog.map(w=>w.country)).size);
  await page.locator('#atlasZoom').click();
  await page.locator('#theme').click();
  await page.locator('#sound').click();
  await page.locator('#pause').click();
  await page.locator('#palette').click();
  await page.locator('#lang').click();
  await page.getByRole('heading', {name:'我在场', exact:true}).waitFor();
  await page.locator('#lang').click();
  await page.getByRole('link', {name:country,exact:true}).click();
  await page.getByRole('link', {name:work.cityEn,exact:true}).click();
  await page.getByRole('button',{name:work.en,exact:true}).click();
  await page.waitForFunction(path => {
   const img=document.querySelector('#large');
   return img.complete && img.naturalWidth>0 && new URL(img.src).pathname==='/'+path;
  },work.detail);
  await page.locator('#viewPhoto').click();
  assert.equal(await page.locator('#viewPhoto').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Escape');
  const downloadRequest=page.waitForResponse(r=>r.url().endsWith('/works/'+work.id+'/download')&&r.request().method()==='POST');
  const downloadEvent=page.waitForEvent('download');
  await page.locator('#download').click();
  const download=await downloadEvent;
  assert.equal(download.suggestedFilename(),'LiwangxuShen-'+work.id+'.jpg');
  assert.deepEqual(await readFile(await download.path()),await readFile('docs/'+work.signed));
  assert.equal((await (await downloadRequest).json()).recorded,true);
  await page.locator('#guestNick').fill('QA');
  await page.locator('#guestBody').fill('Private preview check');
  await page.locator('#sendMessage').click();
  await page.locator('#messageList').getByText('Private preview check',{exact:true}).waitFor();
  if(await page.locator('#next').isEnabled()){
   await page.locator('#next').click();
   await page.locator('#prev').click();
  }
  await page.locator('#messageList').getByText('Private preview check',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('#viewer').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.locator('#back').click();
  await page.reload();
  await page.getByRole('button',{name:work.en,exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('Desktop, mobile, navigation, atlas, language, appearance, photo details, guestbook and signed download passed.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
