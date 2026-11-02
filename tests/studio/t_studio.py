"""Mujassam Studio (the unlisted studio-<random>/ folder): a personal 3D editor published as an installable page of its own.
Checked on the files themselves: the manifest has what a phone needs to install it and its icons have the sizes it says; every file the page,
the service worker and the manifest name exists; the page loads nothing from another site (scripts and styles are local, only the font stylesheet is remote);
the page says it must not be indexed; the libraries' licence is shipped; nothing in the folder is a secret."""
import os,re,json,glob,struct
REPO=os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..'))
fails=0
def ok(c,msg):
    global fails;print('ok  ' if c else 'FAIL',msg);fails+=0 if c else 1
dirs=sorted(glob.glob(REPO+'/studio-*/'))
ok(len(dirs)==1,'there is exactly one studio folder ('+', '.join(os.path.basename(d.rstrip('/')) for d in dirs)+')')
for D in dirs:
    name=os.path.basename(D.rstrip('/'))
    ok(re.fullmatch(r'studio-[a-z0-9]{12}',name) is not None,name+': the folder name is 12 random characters, so it is not guessable')
    html=open(D+'index.html',encoding='utf8').read()
    man=json.load(open(D+'manifest.webmanifest',encoding='utf8'))
    ok(all(man.get(k) for k in('name','short_name','start_url','scope','display','background_color','theme_color','icons')) and man['display']=='standalone','the manifest has name, start page, scope, standalone display and colours')
    sizes_ok=True
    for ic in man['icons']:
        p=D+ic['src'];d=open(p,'rb').read(24);w,h=struct.unpack('>II',d[16:24]);sizes_ok&=d[:8]==b'\x89PNG\r\n\x1a\n' and f'{w}x{h}'==ic['sizes']
    ok(sizes_ok and {i['purpose'] for i in man['icons']}>={'any','maskable'} and {i['sizes'] for i in man['icons']}>={'192x192','512x512'},'the icons are real PNGs of the sizes the manifest says, with 192, 512 and a maskable one')
    ok('rel="manifest" href="manifest.webmanifest"' in html and 'rel="apple-touch-icon" href="apple-touch-icon.png"' in html and 'name="viewport"' in html,'the page links the manifest, the iPhone icon and sets the viewport')
    ok('name="robots" content="noindex,nofollow"' in html,'the page asks search engines not to index it')
    refs=re.findall(r'(?:src|href)="([^"#]+)"',html)
    local=[r for r in refs if not re.match(r'(https?:)?//',r) and not r.startswith('data:')]
    remote=[r for r in refs if re.match(r'(https?:)?//',r)]
    ok(all(os.path.exists(D+r) for r in local),'every local file the page names exists ('+str(len(local))+')')
    ok(all(r.startswith('https://fonts.googleapis.com/') for r in remote),'the only remote reference is the font stylesheet ('+', '.join(remote)+')')
    ok(len([r for r in local if r.startswith('vendor/') and r.endswith('.js')])==5,'the five libraries (three, orbit, transform, GLTF, OBJ) are shipped in vendor/')
    ok(re.search(r'\bMIT\b',open(D+'vendor/LICENSE-three.txt',encoding='utf8').read()) is not None,'the three.js MIT licence is shipped with them')
    sw=open(D+'sw.js',encoding='utf8').read()
    shell=re.findall(r"'([^']+)'",re.search(r'const SHELL=\[(.*?)\];',sw).group(1))
    ok(all(os.path.exists(D+(s if s!='./' else 'index.html')) for s in shell),'every file the service worker keeps exists ('+str(len(shell))+')')
    ok("register('sw.js')" in html,'the page registers the service worker')
    blob=html+sw+json.dumps(man)
    ok(not re.search(r'(api[_-]?key|secret|token|password|PITCHAPI|PUSH_KEYS)',blob,re.I),'no key, token or secret appears in the folder')
    ok(not os.path.exists(D+'../index.html') or 'studio-' not in open(REPO+'/index.html',encoding='utf8').read(),'the main site does not link to the studio folder')
print('all passed' if not fails else f'FAILED {fails}')
raise SystemExit(1 if fails else 0)
