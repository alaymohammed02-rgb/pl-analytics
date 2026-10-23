const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:390,height:860}});await ctx.addInitScript(()=>{localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8777/index.html#/overview');await pg.waitForSelector('#app h2');await pg.waitForTimeout(2500);
 console.log(await pg.evaluate(()=>{const l=document.getElementById('langbtn');let e=l,o=[];while(e&&e!==document.body){const r=e.getBoundingClientRect(),cs=getComputedStyle(e);o.push(e.tagName+'#'+e.id+'.'+e.className+' L'+Math.round(r.left)+' R'+Math.round(r.right)+' W'+Math.round(r.width)+' '+cs.display+' '+cs.flexWrap+' '+cs.gridTemplateColumns);e=e.parentElement}
  const p=l.parentElement.parentElement;return o.concat([...p.children].map(c=>'child '+c.tagName+'#'+c.id+' W'+Math.round(c.getBoundingClientRect().width)+' '+c.outerHTML.slice(0,140)))}));
 await pg.screenshot({path:__dirname+'/shots/hdr.png',clip:{x:0,y:0,width:390,height:130}});await b.close()})();
