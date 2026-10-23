const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const pg=await b.newPage();
 for(const h of ['table','fantasy','players','heatmaps','passing']){await pg.goto('http://127.0.0.1:8777/index.html#/'+h);await pg.waitForTimeout(3500);
 console.log(h,await pg.evaluate(()=>[...document.querySelectorAll('#app th')].slice(0,16).map(t=>t.textContent).join('|')+' :: '+document.getElementById('app').innerText.slice(0,200).replace(/\n/g,' / ')))}
 await b.close()})();
