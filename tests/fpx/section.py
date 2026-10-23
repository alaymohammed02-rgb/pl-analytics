

# ============================================================================
# إضافة: الفانتازي — نموذج v3، فريق النموذج موسم بموسم، وصفحة الأنماط
# نموذج v3 = v2 + معايرة التمريرات الحاسمة حسب المركز: FPL يحسب تمريرات حاسمة أكثر مما يتوقعه xA (ارتداد، ركلة جزاء مكتسبة…)،
#   فمعدل الصناعة من xA يُضرب في 1.45 للمدافع و1.58 للوسط و2.33 للمهاجم. المعاملات من مواسم 2022/23–2024/25 فقط؛ التحقق على
#   2025/26 والاختبار على جولات هذا الموسم المنتهية: الخطأ (RMSE) أقل في المواسم الخمسة، والانحياز أقل في الخمسة، واحتمال المشاركة كما هو.
# فريق النموذج موسم بموسم: نتائج "مراجعة الموسم" لكل موسم جنب بعض (data/fpl_review.json + هذا الموسم بعد تشغيل مراجعته).
# الأنماط: data/fpl_patterns.json محسوب مسبقاً بإعادة تشغيل المواسم بنفس النموذج بدون بيانات مستقبلية.
# ============================================================================
_X_FPXCSS = "@@CSS@@"
_X_FPXJS = r"""@@JS@@"""


def _x_fpx_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (الفانتازي v3): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    # --- model v3: assist calibration (a rate change, so the breakdown, the ranges and the shown rate all agree) ---
    h = sub(h, "const PM_VERSION='v2';",
            "const PM_VERSION='v3';\n/* v3: FPL awards more assists than xA expects (rebounds, penalties won, deflections), the same in every season and position:\n"
            "   the assist rate from xA is scaled by position (fitted on 2022-23 to 2024-25, validated on 2025-26, tested on this season's\n"
            "   finished gameweeks). A rate from FPL assists themselves (no xA in the data) is not scaled. AF:1 everywhere restores v2. */\n"
            "PM.AF={1:1,2:1.45,3:1.58,4:2.33};")
    h = sub(h, " if(xa90!=null&&fa_!=null)lamA=xa90*fa_;else{", " if(xa90!=null&&fa_!=null)lamA=xa90*fa_*((PM.AF&&PM.AF[t])||1);else{")
    h = sub(h, "bonus ${pc(r.R.bon)}.", "bonus ${pc(r.R.bon)}.${PM.AF&&PM.AF[p.ty]!==1&&r.xa90!=null?` The assist rate includes ×${PM.AF[p.ty]} for this position: FPL counts more assists than xA expects.`:''}")
    h = sub(h, "Model tested: <b>v2 = the model used in Predicted Points</b> (playing-time model trained on archived seasons).",
            "Model tested: <b>v3 = the model used in Predicted Points</b> (playing time and assist calibration trained on archived seasons).")
    h = sub(h, "Model v2's five playing-time parameters were tuned on the 2022-23 and 2023-24 seasons, so replays of those two archived seasons are partly in-sample; 2024-25 was the validation season and 2025-26 the untouched test season (error 1.845 → 1.716 against v1).",
            "Model v3: the five playing-time parameters were tuned on 2022-23 and 2023-24 (validated on 2024-25, tested on 2025-26) and the assist calibration on 2022-23 to 2024-25 (validated on 2025-26, tested on this season), so replays of the archived seasons are partly in-sample.")
    # --- season by season ---
    h = sub(h, "<div id=\"srout\"><div class=\"empty\">Loading…</div></div>`;", "<div id=\"srall\"></div><div id=\"srout\"><div class=\"empty\">Loading…</div></div>`;")
    h = sub(h, " srStored(d).then(R=>{if(R){SR.res[k]=R;srDraw()}else srAsk()});", " srStored(d).then(R=>{if(R){SR.res[k]=R;srDraw()}else srAsk()});srAcross();")
    h = sub(h, "srChartWire('srch',gws,S,dl);", "srChartWire('srch',gws,S,dl);srAcross();")
    # --- Patterns tab (for this season and archived seasons alike: its content does not depend on the season shown) ---
    h = sub(h, "['track','Track record']];", "['track','Track record'],['patterns','Patterns']];")
    h = sub(h, "review:fpTReview,track:fpTTrack})[FP.tab]", "review:fpTReview,track:fpTTrack,patterns:fpTPatterns})[FP.tab]")
    h = sub(h, "'backtest','review']);", "'backtest','review','patterns']);")
    h = sub(h, "</style></head>", _X_FPXCSS + "</style></head>")
    h = sub(h, "async function route(){", _X_FPXJS + "\nasync function route(){")
    return h


_AR_SEASON.update(@@AR@@)


INDEX = _x_fpx_index(INDEX)
# ======================== نهاية إضافة الفانتازي v3 ========================
