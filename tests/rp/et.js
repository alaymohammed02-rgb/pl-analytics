const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:1280,height:900}});
await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_1XLtP0');localStorage.setItem('lang','en')}});
const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/replay/m_3uGyGd');
await pg.waitForSelector('#rp .rp-sb',{timeout:60000});
console.log(await pg.evaluate(()=>({sc:document.querySelector('#rpsc').textContent,clk:document.querySelector('#rpclk').textContent,max:document.querySelector('#rpsk').max,marks:document.querySelectorAll('#rptrk i.ht').length,ax:[...document.querySelectorAll('.rp-ch.w .mc-ax')].map(t=>t.textContent).join(' '),hdr:document.querySelector('#app,main,body').innerText.slice(0,300)})));
await b.close()})();
