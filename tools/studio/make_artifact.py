"""Builds the private-Artifact copy of Mujassam Studio from the folder's index.html (the source).
   python3 tools/studio/make_artifact.py <out.html>
   The Artifact page may load scripts only from a few CDNs, so the local vendor/ files become pinned jsDelivr URLs (three.js r128);
   the manifest, service worker and the Draco / meshopt decoders (which need to fetch files) are left out."""
import glob,os,re,sys
REPO=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
src=glob.glob(REPO+'/studio-*/index.html')
if len(src)!=1:sys.exit('expected exactly one studio-*/index.html')
s=open(src[0],encoding='utf8').read()
s=s[s.index('<title>'):]                                    # drop the standalone head (doctype, manifest, icons, robots)
s=s.replace('</html>','')
CDN='https://cdn.jsdelivr.net/npm/three@0.128.0/'
for a,b in [('vendor/three.min.js','build/three.min.js'),('vendor/OrbitControls.js','examples/js/controls/OrbitControls.js'),('vendor/TransformControls.js','examples/js/controls/TransformControls.js'),
            ('vendor/GLTFLoader.js','examples/js/loaders/GLTFLoader.js'),('vendor/OBJLoader.js','examples/js/loaders/OBJLoader.js')]:
    assert a in s,a;s=s.replace('src="'+a+'"','src="'+CDN+b+'"')
for tag in ('<script src="vendor/DRACOLoader.js"></script>\n','<script src="vendor/meshopt_decoder.js"></script>\n','<script>window.MJM_DRACO="vendor/draco/";</script>\n'):
    assert tag in s,tag;s=s.replace(tag,'')
s=re.sub(r"<script>if\('serviceWorker'.*?</script>\n?",'',s,flags=re.S)
assert 'vendor/' not in s and 'serviceWorker' not in s
open(sys.argv[1],'w',encoding='utf8').write(s.rstrip()+'\n')
print('wrote',sys.argv[1],len(s))
