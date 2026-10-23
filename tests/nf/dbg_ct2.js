const T=require('./lib.js');const {ok,J,IDX,DOM}=T;
const src=require('fs').readFileSync(__dirname+'/ui_ct.js','utf8');
eval(src.slice(src.indexOf('const KEYS'),src.indexOf('(async()=>')).replace(/\bconst /g,'var ').replace('var T=require','//').replace('var {ok,J,IDX,DOM}=T;',''));
(async()=>{const b=await T.launch(),Tm=pool(),{ctx,pg}=await T.open(b,{hash:'#/clubtwins'});await pg.waitForSelector('.ct-ol',{timeout:120000});
 const P=await pg.evaluate(()=>window.__CTDBG.teams.map(x=>({key:x.key,n:x.n,v:x.v})));
 const mine=new Map(Tm.map(x=>[x.key,x]));let diffs=0;
 for(const p of P){const m=mine.get(p.key);if(!m){console.log('missing in mine',p.key);continue}
  if(m.n!==p.n)console.log('n differs',p.key,m.n,p.n);
  for(const k of KEYS){const a=p.v[k],c=m.v[k];if((a==null)!==(c==null)||(a!=null&&Math.abs(a-c)>1e-9)){diffs++;if(diffs<14)console.log('value differs',p.key,k,'page',a,'mine',c)}}}
 console.log('teams page',P.length,'mine',Tm.length,'value differences',diffs);await b.close()})();
