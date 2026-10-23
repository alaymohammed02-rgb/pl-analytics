const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const pg=await (await b.newContext()).newPage();
 await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForSelector('#app h2',{timeout:60000});
 const res=await pg.evaluate(async()=>{const o=[];for(const id of ['l_0ErfuF','l_1Isor4','l_0ALvwF','l_4QexZg','l_3FJFUl']){await setLeague(id);await logoLoad();const T=Object.keys(LOGO.d[id].teams).sort();
   for(const t of T){await crestFor(t);const c=crestOf(t),p=thClubPal(t);o.push([D.name,t,c&&c.join(' '),p&&p.th])}}return o});
 for(const r of res)console.log(r.join(' | '));await b.close()})();
