import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
import json
js=open('eng.js').read();css=open('eng.css').read().replace('\n','')
assert '"""' not in js and '"' not in css and not js.rstrip().endswith('\\')
D=json.load(open('ar.json'))
py='''


# ============================================================================
# إضافة: "هذا الأسبوع" ومعلومة اليوم في الصفحة الرئيسية، وصفحة جدول الدوري مع إعادة الموسم بالتحريك
# كل شيء من بيانات الدوري المحمّل (المباريات وإحصائيات اللاعبين والتسديدات)؛ ما في أي رقم مخترع.
# ============================================================================
_X_ENGCSS = "''' + css + '''"
_X_ENGJS = r"""''' + js + '''"""


def _x_eng_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (هذا الأسبوع/جدول الدوري): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "</style></head>", _X_ENGCSS + "</style></head>")
    h = sub(h, "['teams','Teams'],['matches','Matches']", "['teams','Teams'],['table','League table'],['matches','Matches']")
    h = sub(h, "<h3>Top xT</h3>${top(o.top_xt,'xT')}", "<div id=\\"wkhl\\"></div><h3>Top xT</h3>${top(o.top_xt,'xT')}")
    h = sub(h, "mlink(m),tag(m.status)]))}`},", "mlink(m),tag(m.status)]))}`;wkHL($('#wkhl'))},")
    h = sub(h, "async function route(){", _X_ENGJS + "\\nasync function route(){")
    return h


_AR_SEASON.update(''' + json.dumps(D,ensure_ascii=False,indent=4) + ''')


INDEX = _x_eng_index(INDEX)
# ======================== نهاية إضافة هذا الأسبوع وجدول الدوري ========================'''
p=REPO+'/sync.py';t=open(p,encoding='utf-8').read()
a=t.find('\n\n\n# ============================================================================\n# إضافة: "هذا الأسبوع"')
if a>=0:
    b=t.index("# ======================== نهاية إضافة هذا الأسبوع وجدول الدوري ========================")+len("# ======================== نهاية إضافة هذا الأسبوع وجدول الدوري ========================")
    t=t[:a]+t[b:]
end="# ======================== نهاية إضافة سجل التوقعات ========================"
assert t.count(end)==1
t=t.replace(end,end+py);open(p,'w',encoding='utf-8').write(t);print('inserted')
