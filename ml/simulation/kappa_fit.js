// node simulation/kappa_fit.js new_2022-23 new_2023-24 new_2024-25 [new_2025-26] — fits the widening factor on the two TRAIN files and reports 80%-range coverage on the others
const fs=require('fs');const ld=s=>JSON.parse(fs.readFileSync(__dirname+'/'+s+'.json','utf8')).lin;
const tr=[...ld(process.argv[2]||'new_2022-23'),...ld(process.argv[3]||'new_2023-24')],rnd=L=>L.filter(x=>x.kind==='rand'),opt=L=>L.filter(x=>x.kind==='opt');
const zsd=L=>Math.sqrt(L.reduce((a,o)=>a+((o.act-o.mean)/o.sd)**2,0)/L.length);
const cov=(L,k)=>L.filter(o=>o.act>=o.mean-k*(o.mean-o.p10)&&o.act<=o.mean+k*(o.p90-o.mean)).length/L.length;
const side=(L,k)=>[L.filter(o=>o.act<o.mean-k*(o.mean-o.p10)).length/L.length,L.filter(o=>o.act>o.mean+k*(o.p90-o.mean)).length/L.length];
/* κ fitted on TRAIN two ways: z-sd (the site's rule) and the factor that gives exactly 80% coverage */
const kz=zsd(rnd(tr));let kc=1;for(let k=1;k<=2.5;k+=0.005){if(cov(rnd(tr),k)>=0.8){kc=k;break}}
console.log('TRAIN random XIs',rnd(tr).length,'kappa z-sd',kz.toFixed(3),'| kappa for 80% coverage',kc.toFixed(3),'| cov at 1',cov(rnd(tr),1).toFixed(3),'| opt XIs bias',(opt(tr).reduce((a,o)=>a+o.act-o.mean,0)/opt(tr).length).toFixed(2));
for(const s of process.argv.slice(4)){const L=ld(s);
 for(const [n,k] of [['1 (none)',1],['1.25 (current)',1.25],['train z-sd '+kz.toFixed(3),kz],['train 80% '+kc.toFixed(3),kc]])
  console.log(s,'kappa',n.padEnd(18),'random cov',cov(rnd(L),k).toFixed(3),'below/above',side(rnd(L),k).map(x=>x.toFixed(3)).join('/'),'| optimal XI cov',cov(opt(L),k).toFixed(3),'below/above',side(opt(L),k).map(x=>x.toFixed(3)).join('/'))}
