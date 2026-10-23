

# ============================================================================
# إضافة: Intelligence Lab — توقعاتك (نقاط الفانتازي ومين يجيب نقاط أكثر) قبل الموعد النهائي، تقييمها بالنقاط الرسمية،
# مقارنتها بتوقع النموذج المحفوظ قبل الموعد، أنماطك (Analytical DNA) لما تكفي البيانات، واكتشاف من بيانات حقيقية.
# كل شي في الصفحة فقط: التوقعات تنحفظ في متصفح المستخدم (localStorage: plx_lab_v1)، ولا تغيير في المزامنة أو البيانات.
# ============================================================================
_X_LABCSS = "@@CSS@@"
_X_LABJS = r"""@@JS@@"""


def _x_lab_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (Intelligence Lab): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "</style></head>", _X_LABCSS + "</style></head>")
    h = sub(h, "async function route(){", _X_LABJS + "\nasync function route(){")
    h = sub(h, "['fantasy','Fantasy'],", "['fantasy','Fantasy'],['lab','Intelligence Lab'],")
    return h


_AR_SEASON.update(@@AR@@)


INDEX = _x_lab_index(INDEX)
# ======================== نهاية إضافة Intelligence Lab ========================
