/* Browser notifications, the page side (assets/notify.js "On this device", sw.js push handlers). The real push services cannot be reached from here, so the browser's
   subscription is a stand-in (PushManager.subscribe / getSubscription answer with a made-up subscription) and ntfy.sh's inbox topic is answered by the test; the rest is
   the real page and the real service worker file:
   - the button shows only when data/push_status.json says ready and the browser can do it; otherwise the reason is said (not set up, iPhone outside the Home Screen,
     no support, blocked) and the ntfy app list is open;
   - pressing "Turn on" asks permission, subscribes with the public VAPID key of data/push.json, and sends ONE sealed message to the inbox topic pla-<namespace>_inbox that
     the Python side (sync.py push_open, with the private key) opens: the subscription, the starred teams and the language; the card then says on, and a welcome notification is shown;
   - changing the starred teams sends the new list; "Turn off" unsubscribes and sends a removal; a failing inbox shows an error and keeps the page working;
   - sw.js: the push handler shows title and body from the message, keeps a link only if it is inside the site, survives a message that is not JSON; a tap focuses an open window
     of the site and goes to the link, or opens a window; Arabic, 390 px. */
const T=require('../nf/lib.js');const {ok}=T;const crypto=require('crypto'),fs=require('fs'),path=require('path'),vm=require('vm');const {execFileSync}=require('child_process');
const ROOT=path.join(__dirname,'..','..'),CFG=T.J('notify.json');
const pair=()=>{const k=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),j=k.publicKey.export({format:'jwk'}),d=k.privateKey.export({format:'jwk'}).d;
 const raw=Buffer.concat([Buffer.from([4]),Buffer.from(j.x,'base64url'),Buffer.from(j.y,'base64url')]);return {pub:raw.toString('base64url'),priv:d}};
const V=pair(),B=pair();
const open=sealed=>JSON.parse(execFileSync('python3',['-c',`import re,json,sys,os,datetime,base64,hashlib,unicodedata,urllib.request
src=open(${JSON.stringify(path.join(ROOT,'sync.py'))},encoding='utf-8').read()
G={'re':re,'json':json,'os':os,'datetime':datetime,'log':print,'run_pipeline':lambda h,k:1,'gh_get_json':None,'gh_put':None}
exec(src[src.index('# ===== NOTIFY START ====='):src.index('# ===== NOTIFY END =====')],G)
print(json.dumps(G['push_open'](sys.argv[1],json.loads(sys.stdin.read()))))`,B.priv],{input:sealed}).toString());
const FAV=(...t)=>({plx_favs_v2:JSON.stringify({v:2,t:t.map(([l,n])=>({l,t:n}))})});
const LG='l_4WFCIZ';
/* a made-up subscription and a recorder of what the page asks of the browser */
const STUB=(perm)=>`(()=>{window.__calls=[];
 {const sn=ServiceWorkerRegistration.prototype.showNotification;ServiceWorkerRegistration.prototype.showNotification=function(t,o){window.__calls.push(['show',t,o&&o.tag]);return sn.apply(this,arguments)}}
 /* headless Chromium reports Notification.permission "denied" even when the context grants it, so the permission state is a stand-in too: "default" until asked, then what the test says the user answers */
 {let st='default';Object.defineProperty(Notification,'permission',{get:()=>st,configurable:true});Notification.requestPermission=async()=>{window.__calls.push(['ask']);st=${perm?"'granted'":"'denied'"};return st}}
 if(typeof PushManager==='undefined')return;let sub=null;
 PushManager.prototype.getSubscription=async function(){return sub};
 PushManager.prototype.subscribe=async function(o){window.__calls.push(['subscribe',Array.from(new Uint8Array(o.applicationServerKey)).length,o.userVisibleOnly]);window.__key=Array.from(new Uint8Array(o.applicationServerKey));
  sub={endpoint:'https://push.test/endpoint-1',toJSON(){return {endpoint:'https://push.test/endpoint-1',expirationTime:null,keys:{p256dh:'BPtest'.padEnd(87,'x'),auth:'authtest'.padEnd(22,'y')}}},async unsubscribe(){window.__calls.push(['unsubscribe']);sub=null;return true}};return sub}})();`;
async function ctxFor(b,{vw=1100,lang='en',ready=true,perm=true,inbox=200,favs=[[LG,'Arsenal'],[LG,'Chelsea']],stub=true,ua=null,noPush=false}={}){
 const c=await b.newContext({viewport:{width:vw,height:900},permissions:perm?['notifications']:[],...(ua?{userAgent:ua}:{})});
 const posts=[];
 await c.addInitScript(([l,f,st,np])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l);localStorage.setItem('plx_favs_v2',f)}if(np){delete window.PushManager}},[lang,FAV(...favs).plx_favs_v2,stub,noPush]);
 if(stub)await c.addInitScript(STUB(perm));
 await c.route(/\/data\/push\.json/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({v:1,vapid:V.pub,box:B.pub})}));
 await c.route(/\/data\/push_status\.json/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({v:1,ready})}));
 await c.route(/ntfy\.sh\/pla-.*_inbox/,r=>{posts.push({url:r.request().url(),body:r.request().postData(),type:r.request().headers()['content-type']});r.fulfill({status:inbox,headers:{'access-control-allow-origin':'*'},body:'{}'})});
 const pg=await c.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|favicon|cdn.pitchapi/.test(m.text()))errs.push(m.text())});
 await pg.goto('http://127.0.0.1:8765/index.html#/overview');return {c,pg,posts,errs};
}
(async()=>{const b=await T.launch();
 /* ---- ready: the button, the flow, the sealed message */
 let {c,pg,posts,errs}=await ctxFor(b);await pg.waitForSelector('#ntfon',{timeout:90000});
 ok(await pg.$eval('#ntfp h4',e=>e.innerText)==='On this device'&&!(await pg.$eval('.ntf-alt',e=>e.open)),'ready: the card offers "Turn on notifications" for this device, and the ntfy list is folded');
 await pg.click('#ntfon');await pg.waitForSelector('#ntfoff',{timeout:30000});await pg.waitForTimeout(500);
 const calls=await pg.evaluate(()=>window.__calls);
 const sc=calls.find(x=>x[0]==='subscribe')||[];ok(calls[0][0]==='ask'&&sc[1]===65&&sc[2]===true&&JSON.stringify(await pg.evaluate(()=>window.__key))===JSON.stringify([...Buffer.from(V.pub,'base64url')]),'it subscribes with userVisibleOnly and exactly the public VAPID key of data/push.json (65 bytes)');
 ok(posts.length===1&&posts[0].url==='https://ntfy.sh/pla-'+CFG.ns+'_inbox'&&/^text\/plain/.test(posts[0].type||''),'one message goes to the inbox topic pla-<namespace>_inbox on ntfy.sh, as plain text (no preflight)');
 let m1=open(posts[0].body);
 ok(m1&&m1.v===1&&m1.sub.endpoint==='https://push.test/endpoint-1'&&m1.sub.keys.p256dh.startsWith('BPtest')&&JSON.stringify(m1.teams)===JSON.stringify(['Arsenal','Chelsea'])&&m1.lang==='en','the Python side opens it with the private key: the subscription, the two starred teams and the language');
 ok(!/endpoint|push\.test|Arsenal|BPtest/.test(posts[0].body),'and the text that travels holds none of it in the clear');
 ok(/on\b/.test(await pg.innerText('.ntf-on'))&&/2 teams/.test(await pg.innerText('.ntf-on')),'the card now says notifications are on for 2 teams');
 const welcome=await pg.evaluate(()=>window.__calls.filter(x=>x[0]==='show').map(x=>x[1]));
 ok(welcome.length===1&&/Notifications are on/.test(welcome[0]),'a welcome notification is shown, so you see at once that it works ('+welcome[0]+')');
 ok(await pg.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return !!r&&/sw\.js$/.test(r.active?r.active.scriptURL:(r.installing||r.waiting||{scriptURL:''}).scriptURL)}),'the service worker sw.js is registered');
 /* the teams change: the new list is sent, with no page open on the card */
 await pg.selectOption('#ovtt','Brentford');await pg.click('#ovta');await pg.waitForFunction(()=>true);await pg.waitForTimeout(2000);
 ok(posts.length===2&&JSON.stringify(open(posts[1].body).teams)===JSON.stringify(['Arsenal','Chelsea','Brentford']),'starring Brentford sends the new list of 3 teams (a second sealed message)');
 /* turn off */
 await pg.waitForSelector('#ntfoff');await pg.click('#ntfoff');await pg.waitForSelector('#ntfon',{timeout:20000});await pg.waitForTimeout(300);
 const m3=posts.length===3?open(posts[2].body):null;
 ok((await pg.evaluate(()=>window.__calls.filter(x=>x[0]==='unsubscribe').length))===1&&m3&&m3.remove==='https://push.test/endpoint-1','"Turn off" unsubscribes and sends a sealed removal of that endpoint');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await c.close();
 /* ---- Arabic: language in the message and the card */
 ({c,pg,posts,errs}=await ctxFor(b,{lang:'ar',vw:390}));await pg.waitForSelector('#ntfon',{timeout:90000});
 ok(/فعّل الإشعارات/.test(await pg.innerText('#ntfon'))&&await T.noscroll(pg),'Arabic phone: the button is in Arabic and the page does not scroll sideways');
 await pg.click('#ntfon');await pg.waitForSelector('#ntfoff',{timeout:30000});
 ok(open(posts[0].body).lang==='ar'&&/شغّالة/.test(await pg.innerText('.ntf-on')),'Arabic: the message says lang "ar" and the card says on in Arabic');
 {const u=await pg.evaluate(`(${T.untr})('#ntfcard','select,option,.fx-en,bdi')`);ok(!u.length,'Arabic: the card is translated '+u.slice(0,4).join(' | '))}
 await pg.screenshot({path:__dirname+'/push_390_ar.png'});ok(!errs.length,'Arabic phone: no page errors '+errs.slice(0,2).join(' ; '));await c.close();
 /* ---- not ready, blocked, unsupported */
 ({c,pg,errs}=await ctxFor(b,{ready:false}));await pg.waitForSelector('#ntfp .ntf-m',{timeout:90000});
 ok(!(await pg.$('#ntfon'))&&/not switched on/.test(await pg.innerText('#ntfp'))&&await pg.$eval('.ntf-alt',e=>e.open),'not ready (no sender key on GitHub yet): no button, the reason is said, the ntfy list is open');await c.close();
 ({c,pg,errs}=await ctxFor(b,{perm:false}));await pg.waitForSelector('#ntfon',{timeout:90000});await pg.click('#ntfon');await pg.waitForTimeout(1500);
 ok(!(await pg.$('#ntfoff'))&&((await pg.innerText('#ntfp')).match(/blocked|Turn on notifications/)||[]).length>0&&!errs.length,'permission refused: the card stays off (it says blocked, or offers the button again), nothing is sent, no error');await c.close();
 ({c,pg,errs}=await ctxFor(b,{noPush:true}));await pg.waitForSelector('#ntfp .ntf-m',{timeout:90000});
 ok(!(await pg.$('#ntfon'))&&/cannot receive notifications/.test(await pg.innerText('#ntfp')),'a browser without push: no button, the reason, the ntfy list open');await c.close();
 ({c,pg,errs}=await ctxFor(b,{noPush:true,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'}));await pg.waitForSelector('#ntfp .ntf-m',{timeout:90000});
 ok(/Add to Home Screen/.test(await pg.innerText('#ntfp')),'an iPhone outside the Home Screen: it says to add the site to the Home Screen first');await c.close();
 /* ---- the inbox fails */
 ({c,pg,posts,errs}=await ctxFor(b,{inbox:500}));await pg.waitForSelector('#ntfon',{timeout:90000});await pg.click('#ntfon');await pg.waitForSelector('.ntf-err',{timeout:30000});
 ok(/Could not turn notifications on/.test(await pg.innerText('.ntf-err'))&&!!(await pg.$('#ntfon'))&&!errs.length,'the inbox answers 500: the card says it could not turn them on and offers the button again, no page error');await c.close();
 /* ---- no teams: no card; one team: the card */
 ({c,pg,errs}=await ctxFor(b,{favs:[]}));await pg.waitForSelector('.ovt',{timeout:90000});await pg.waitForTimeout(800);ok(!(await pg.$('#ntfcard')),'no starred team: no card');await c.close();
 /* ---- sw.js, the real file, in a sandbox */
 const code=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
 function sw(scope){const H={},shown=[],wins=[];const self={addEventListener:(t,f)=>H[t]=f,registration:{scope,showNotification:(t,o)=>{shown.push([t,o]);return Promise.resolve()}},skipWaiting(){},clients:{async matchAll(){return wins},async openWindow(u){wins.opened=u;return {}}}};
  vm.runInNewContext(code,{self,caches:{open:async()=>({addAll:async()=>0})},fetch:async()=>({}),URL,Response:function(){},Promise,console,JSON,String,Array},{filename:'sw.js'});return {H,shown,wins}}
 const run=async(S,type,ev)=>{let p;ev.waitUntil=x=>{p=x};S.H[type](ev);await p};
 const SC='https://me.github.io/pla/';let S=sw(SC);
 await run(S,'push',{data:{json:()=>({title:'Arsenal 2–1 Chelsea',body:'Full time · Premier League',url:SC+'#/match/m1',tag:'m1|arsenal'})}});
 ok(S.shown.length===1&&S.shown[0][0]==='Arsenal 2–1 Chelsea'&&S.shown[0][1].body==='Full time · Premier League'&&S.shown[0][1].data.url===SC+'#/match/m1'&&S.shown[0][1].tag==='m1|arsenal'&&S.shown[0][1].lang==='en'&&/icon-192/.test(S.shown[0][1].icon),'push: the title, body, tag, icon and the link of the message are shown');
 await run(S,'push',{data:{json:()=>({title:'أرسنال 2–1',body:'انتهت المباراة',url:'https://evil.example/x'})}});
 ok(S.shown[1][1].lang==='ar'&&S.shown[1][1].data.url===SC,'push: an Arabic message is marked Arabic, and a link outside the site is replaced by the site\'s own address');
 await run(S,'push',{data:{json:()=>{throw new Error('not json')}}});await run(S,'push',{});
 ok(S.shown.length===4&&S.shown[2][0]==='PL Analytics'&&S.shown[3][0]==='PL Analytics','push: a message that is not JSON, or has no data, still shows a notification (so the browser never shows its own "this site updated in the background")');
 await run(S,'push',{data:{json:()=>({title:'x'.repeat(500),body:'y'.repeat(900)})}});
 ok(S.shown[4][0].length<=120&&S.shown[4][1].body.length<=240,'push: very long texts are cut');
 let closed=0,navTo='',focused=0;S.wins.push({url:SC+'#/table',navigate:async u=>{navTo=u},focus:async()=>{focused++}});
 await run(S,'notificationclick',{notification:{close:()=>closed++,data:{url:SC+'#/match/m1'}}});
 ok(closed===1&&navTo===SC+'#/match/m1'&&focused===1,'a tap closes the notification, goes to its link in the window that is open and focuses it');
 S.wins.length=0;await run(S,'notificationclick',{notification:{close:()=>closed++,data:{url:SC+'#/preview/f1'}}});
 ok(S.wins.opened===SC+'#/preview/f1','a tap with no window open opens one at the link');
 await T.done(b)})();
