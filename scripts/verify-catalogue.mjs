import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../dist/server/index.js';
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const hotels=read('public/data/hotels.json'),reference=read('content/reference/hotels.json'),places=read('public/data/destinations.json'),packages=read('public/data/packages.json');
assert.equal(hotels.length,488);assert.equal(hotels.filter(h=>h.type==='india').length,268);assert.equal(hotels.filter(h=>h.type==='international').length,220);assert.equal(places.length,251);assert.equal(packages.length,6);
assert.equal(new Set(hotels.map(h=>h.slug)).size,hotels.length);
assert.deepEqual(hotels.map(h=>h.slug),reference.map(h=>h.slug));
for(const h of hotels){assert.ok(h.name&&h.city&&h.region&&['india','international'].includes(h.type));if(h.image)assert.ok(fs.existsSync('public'+h.image),h.image);}
for(const p of packages)assert.ok(p.image&&fs.existsSync('public'+p.image),p.name);
const routes=['/','/hotels','/hotel','/india','/international','/destinations','/packages','/activities','/travel-desk','/membership','/experiences','/about','/contact','/login','/customer-care','/payment','/privacy','/booking-guidance','/terms','/refund-cancellation','/disclaimer','/cookies'];
for(const route of routes){const res=await worker.fetch(new Request('https://mayfair.test'+route),{});assert.equal(res.status,200,route);assert.ok((await res.text()).includes('Grand Mayfair'));}
for(const name of ['hotels','destinations','packages']){const res=await worker.fetch(new Request(`https://mayfair.test/data/${name}.json`),{});assert.ok(res.headers.get('Content-Type').includes('application/json'));assert.ok(Array.isArray(await res.json()));}
const allowed=new Set([...routes,'/admin','/employee','/customer','/portal']);
for(const file of fs.readdirSync('public').filter(f=>f.endsWith('.html')&&f!=='portal.html')){const html=fs.readFileSync('public/'+file,'utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,file+' duplicate id');assert.ok(html.includes('class="public-site'));
 for(const [,href]of html.matchAll(/href="(\/[^"?#]*)/g))if(!href.startsWith('/assets/')&&!/\.(css|js)$/.test(href))assert.ok(allowed.has(href),`${file}: unknown route ${href}`);
}
assert.ok(!fs.readFileSync('public/portal.html','utf8').includes('motion.css'));
console.log('Catalogue verified: all 488 source hotels, 251 destinations, 6 packages, 22 public routes, local images, JSON delivery and internal links.');
