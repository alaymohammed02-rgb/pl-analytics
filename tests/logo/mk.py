import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
import zlib,struct,base64,json,math
def png(w,h,px):
    raw=b''.join(b'\x00'+b''.join(bytes(px(x,y)) for x in range(w)) for y in range(h))
    c=lambda t,d:struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+c(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+c(b'IDAT',zlib.compress(raw))+c(b'IEND',b'')
H=lambda s:tuple(int(s[i:i+2],16) for i in (1,3,5))
def crest(fn):
    def px(x,y):
        dx,dy=x-31.5,y-31.5
        if dx*dx+dy*dy>30*30:return (0,0,0,0)
        return fn(x,y,math.hypot(dx,dy))+(255,)
    return 'data:image/png;base64,'+base64.b64encode(png(64,64,px)).decode()
L={
 'Barcelona':crest(lambda x,y,r:H('#004d98') if x<32 else H('#a50044')),
 'Real Madrid':crest(lambda x,y,r:H('#febe10') if r>24 else H('#ffffff')),
 'Atlético Madrid':crest(lambda x,y,r:H('#cb3524') if (x//8)%2==0 else H('#ffffff')),
}
B={'Bayern München':crest(lambda x,y,r:H('#dc052d') if r>16 else H('#0066b2')),'Borussia Dortmund':crest(lambda x,y,r:H('#fde100') if r>10 else H('#000000'))}
S={'Juventus':crest(lambda x,y,r:H('#000000') if (x//8)%2==0 else H('#ffffff'))}
P={'Arsenal':crest(lambda x,y,r:H('#ef0107') if r>12 else H('#ffffff'))}
PT={'Alverca':crest(lambda x,y,r:H('#c8102e') if r>14 else H('#0047ab')),'Casa Pia AC':crest(lambda x,y,r:H('#000000') if (x//8)%2==0 else H('#ffffff'))}
lg=lambda c:crest(lambda x,y,r:H(c))
files={'l_0ErfuF':dict(league=lg('#ff4b44'),teams=L),'l_1Isor4':dict(league=lg('#d10214'),teams=B),'l_0ALvwF':dict(league=lg('#0059d6'),teams=S),'l_4WFCIZ':dict(league=lg('#37003c'),teams=P),'l_4QexZg':dict(league=lg('#003893'),teams=PT)}
ix=json.load(open(REPO+'/data/index.json'))
for l in ix['leagues']:
    l.pop('logo_file',None);l.pop('logo_v',None)
    if l['id'] in files:
        fn=f"logos_{l['id']}.json";json.dump(files[l['id']],open('lgweb/data/'+fn,'w'));l['logo_file']=fn;l['logo_v']='t1'
json.dump(ix,open('lgweb/data/index.json','w'))
print('ok',[l['name'] for l in ix['leagues'] if l.get('logo_file')])
