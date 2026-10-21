// Writes the Fantasy code of the live page (index.html) to a file the harness can load:
// the Fantasy model, optimizers and simulation, plus the Season review section. Usage: node page_code.js <out.js>
const fs=require('fs'),path=require('path');
const h=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const a=h.indexOf('/* ===== Fantasy (FPL) ===== */'),b=h.indexOf('/* ===== Fantasy seasons:'),s=h.indexOf('/* ===== Season review:');
if(a<0||b<0||s<0)throw new Error('markers not found in index.html');
const e=Math.min(...[h.indexOf('\nasync function route(){',s),h.indexOf('/* =====',s+10)].filter(i=>i>0));
fs.writeFileSync(process.argv[2]||path.join(__dirname,'page_fantasy.js'),h.slice(a,b)+'\n'+h.slice(s,e));
