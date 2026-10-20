// Like harness.js, plus fetch() from the repo folder and ALL from data/index.json.
const fs=require('fs'),vm=require('vm'),path=require('path');
const REPO='/home/user/pl-analytics';
function load(jsPath,dataPath){
 const ctx={console,Math,Date,JSON,Map,Set,Promise,setTimeout,Float64Array,Uint8Array,Int16Array,Uint32Array,Array,Object,String,Number,isFinite,parseInt,parseFloat,Error,RegExp,Infinity,NaN,
  document:{querySelector:()=>null,getElementById:()=>null},localStorage:{_s:{},getItem(k){return this._s[k]??null},setItem(k,v){this._s[k]=String(v)},removeItem(k){delete this._s[k]}},
  fetch:async u=>{const f=path.join(REPO,u.split('?')[0]);if(!fs.existsSync(f))return {ok:false,status:404};const t=fs.readFileSync(f,'utf8');return {ok:true,status:200,json:async()=>JSON.parse(t)}}};
 vm.createContext(ctx);
 const ALL=JSON.parse(fs.readFileSync(REPO+'/data/index.json','utf8'));
 vm.runInContext(`const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=(v,d=3)=>v==null?'N/A':Number(v).toFixed(d);
const tbl=(h,rows)=>'';const R={};let ALL=${JSON.stringify(ALL)},D=null;`+fs.readFileSync(jsPath,'utf8')+`
;globalThis.__api={get FPD(){return FPD},set FPD(v){FPD=v},ev:s=>eval(s)};`,ctx);
 const d=JSON.parse(fs.readFileSync(dataPath||REPO+'/data/fpl.json','utf8'));
 const prep=d=>{d.T=new Map(d.teams.map(t=>[t.id,t]));
 d.P=d.rows.map(r=>{const o={};d.cols.forEach((c,i)=>o[c]=r[i]);const t=d.T.get(o.tm)||{};o.tn=t.s||'?';o.tf=t.n||'?';o.pos=o.ty;o.name=o.wn;o.price=typeof o.now_cost==='number'?o.now_cost/10:null;o.chg=typeof o.cost_change_start==='number'?o.cost_change_start/10:null;return o});
 d.PB=new Map(d.P.map(p=>[p.id,p]));return d};
 prep(d);ctx.__api.FPD=d;
 return {api:ctx.__api,ev:ctx.__api.ev,d,ctx,prep};
}
module.exports={load};
