import fs from 'node:fs';
import path from 'node:path';
import {createPages} from './pages.mjs';
createPages();
const root=process.cwd();const dist=path.resolve(root,'dist');
if(path.dirname(dist)!==root||path.basename(dist)!=='dist')throw new Error('Unsafe build output path');
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
for(const file of fs.readdirSync('worker'))if(file.endsWith('.js'))fs.copyFileSync(path.join('worker',file),path.join('dist/server',file));
const assets={};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.xml':'application/xml','.txt':'text/plain; charset=utf-8'};
function collect(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const filename=path.join(folder,entry.name);if(entry.isDirectory())collect(filename);else{const extension=path.extname(filename);const binary=extension==='.jpg';assets['/'+path.relative('public',filename).split(path.sep).join('/')]={type:types[extension]||'application/octet-stream',binary,content:fs.readFileSync(filename,binary?'base64':'utf8')};}}}
collect('public');fs.writeFileSync('dist/server/assets.js',`export default ${JSON.stringify(assets)};\n`);
fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
console.log(`Built ${Object.keys(assets).length} website assets and the CRM Worker.`);
