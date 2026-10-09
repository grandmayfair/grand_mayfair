import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const html=fs.readFileSync('dist/index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(ids).size,ids.length,'HTML IDs must be unique');
assert.equal((html.match(/<main\b/g)||[]).length,1);
assert.equal((html.match(/<\/main>/g)||[]).length,1);
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  const url=match[1];
  if(url==='#')continue;
  if(url.startsWith('#'))assert(ids.includes(url.slice(1)),`Missing anchor: ${url}`);
  else if(!/^https?:/.test(url))assert(fs.existsSync(path.join('dist',url)),`Missing asset: ${url}`);
}
new Function(fs.readFileSync('dist/app.js','utf8'));
assert(fs.statSync('dist/assets/island.jpg').size>10000);
assert(fs.statSync('dist/assets/mountains.jpg').size>10000);
assert(fs.statSync('dist/assets/jaipur.jpg').size>10000);
console.log('Verified HTML structure, unique IDs, section links, local assets, and JavaScript syntax.');
