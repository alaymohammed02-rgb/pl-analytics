

# ============================================================================
# إضافة: واجهة الاستخدام — خمسة أقسام فوق القائمة (وشريط سفلي على الجوال)، بحث موحّد، شرح المصطلحات (ⓘ)، وفريقك المفضل.
# كله يشتغل بعد رسم الصفحة (MutationObserver)، فما يتغير كود أي صفحة؛ والقائمة الأصلية تبقى بروابطها كلها.
# ============================================================================
_X_UICSS = "@@CSS@@"
_X_TBL = r"""/* a table of more than 80 rows shows its first 60 at once and the rest right after the first paint (one more layout), in the
   same order, so a long table appears without a pause. Pending rows of a table that has left the page are dropped. */
const TBLQ=new Map();let TBLN=0,TBLP=false;
const tblRow=(h,r)=>`<tr>${r.map((c,i)=>`<td class="${h[i]&&h[i][1]?'n':''}">${c}</td>`).join('')}</tr>`;
function tblPump(){if(TBLP)return;TBLP=true;requestAnimationFrame(()=>{TBLP=false;
 for(const [id,q] of TBLQ){const t=document.querySelector('table[data-tq="'+id+'"]');if(!t){if(++q.miss>120)TBLQ.delete(id);continue}
  const tb=t.tBodies[t.tBodies.length-1]||t;tb.insertAdjacentHTML('beforeend',q.rows.splice(0).join(''));if(!q.rows.length){TBLQ.delete(id);t.removeAttribute('data-tq')}}
 if(TBLQ.size)tblPump()})}
const tbl=(h,rows)=>{if(!rows.length)return '<div class="empty">No data yet. Press Synchronize in Settings to update the data.</div>';
 const head=`<tr>${h.map(x=>`<th class="${x[1]?'n':''}">${x[0]}</th>`).join('')}</tr>`;
 if(rows.length<=80)return `<div class="wrap"><table>${head}${rows.map(r=>tblRow(h,r)).join('')}</table></div>`;
 const id='t'+(++TBLN);TBLQ.set(id,{rows:rows.slice(60).map(r=>tblRow(h,r)),miss:0});tblPump();
 return `<div class="wrap"><table data-tq="${id}">${head}${rows.slice(0,60).map(r=>tblRow(h,r)).join('')}</table></div>`};"""
_X_UIJS = r"""@@JS@@"""


def _x_ui_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (الواجهة): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "</style></head>", _X_UICSS + "</style></head>")
    h = sub(h, "async function route(){", _X_UIJS + "\nasync function route(){")
    # سلاسة: توحيد الأسماء في الفانتازي يُحسب ملايين المرات بنفس المدخلات؛ نحفظ النتيجة (نفس الناتج بالضبط)
    h = sub(h, "const fpNz=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();",
            "const FPNZ=new Map(),fpNz=s=>{const k=String(s||'');let v=FPNZ.get(k);if(v===undefined){v=k.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();if(FPNZ.size>20000)FPNZ.clear();FPNZ.set(k,v)}return v};")
    h = sub(h, "const fpTeamEq=(a,b)=>{a=fpNz(a);b=fpNz(b);a=FPAL[a]||a;b=FPAL[b]||b;return !!a&&!!b&&(a===b||a.includes(b)||b.includes(a))};",
            "const FPTE=new Map(),fpTeamEq=(a,b)=>{a=String(a||'');b=String(b||'');let m=FPTE.get(a);if(!m){if(FPTE.size>2000)FPTE.clear();m=new Map();FPTE.set(a,m)}let v=m.get(b);if(v===undefined){let x=fpNz(a),y=fpNz(b);x=FPAL[x]||x;y=FPAL[y]||y;v=!!x&&!!y&&(x===y||x.includes(y)||y.includes(x));m.set(b,v)}return v};")
    # سلاسة: الجداول الكبيرة (أكثر من 80 صف) ترسم أول 60 صف فوراً والباقي على دفعات في الإطارات التالية (نفس الصفوف بنفس الترتيب)
    h = sub(h, "const tbl=(h,rows)=>rows.length?`<div class=\"wrap\"><table><tr>${h.map(x=>`<th class=\"${x[1]?'n':''}\">${x[0]}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class=\"${h[i][1]?'n':''}\">${c}</td>`).join('')}</tr>`).join('')}</table></div>`:'<div class=\"empty\">No data yet. Press Synchronize in Settings to update the data.</div>';",
            _X_TBL)
    return h


_AR_SEASON.update(@@AR@@)


INDEX = _x_ui_index(INDEX)
# ======================== نهاية إضافة الواجهة ========================
