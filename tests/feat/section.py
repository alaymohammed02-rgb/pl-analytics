

# ============================================================================
# إضافة: ملفات الميزات المستقلة — Threat Map داخل صفحة Heatmaps، وصفحة Match What-If، وصفحة اللاعب، ومركز المباراة،
# وشريط مباريات اليوم ولاعب الجولة في الرئيسية، والمشاركة كصورة، وتثبيت الموقع كتطبيق (PWA).
# الكود في ملفات مستقلة في المستودع: assets/*.js و assets/features.css و manifest.webmanifest و sw.js و assets/icons/.
# هذا القسم يضيف روابطها للصفحة فقط (بعد السكربت الرئيسي، فتلقى R و PAGES جاهزة). غيّر FEATURES_V لما تتغير الملفات.
# ============================================================================
FEATURES_V = "6"
FEATURES_JS = ("pla-data", "share-card", "threat-map", "match-whatif", "player-page", "match-centre", "home-extra", "team-round",
               "preview", "club-extra", "rankings-extra", "fantasy-extra", "insights-core", "hidden-gems", "player-dna", "team-dna",
               "reality-check", "matches-board")


def _x_feat_index(html):
    old = "</script></body></html>"
    if html.count(old) != 1:
        log("  تنبيه (ملفات الميزات): ما لقيت نهاية الصفحة بدقة، تخطيتها")
        return html
    v = FEATURES_V
    # the heat map legend follows the smooth colour scale of assets/threat-map.js when it is loaded
    leg = "const heatLegend=max=>"
    if html.count(leg) == 1:
        html = html.replace(leg, "const heatLegend=max=>typeof heatLegend2==='function'?heatLegend2(max):")
    else:
        log("  تنبيه (ملفات الميزات): ما لقيت مفتاح خريطة الحرارة، تخطيته")
    # installable app: manifest, icons, theme colour, and the service worker (registered after the page has loaded)
    head = "<title>PL Analytics</title>"
    if html.count(head) == 1:
        html = html.replace(head, '<title>PL Analytics</title><link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#0d1520">'
                                  '<link rel="icon" type="image/png" sizes="32x32" href="assets/icons/favicon-32.png">'
                                  '<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">'
                                  '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
                                  '<meta name="apple-mobile-web-app-title" content="PL Analytics">', 1)
    else:
        log("  تنبيه (ملفات الميزات): ما لقيت عنوان الصفحة، تخطيت ملف التطبيق")
    js = "".join(f'<script src="assets/{n}.js?v={v}"></script>' for n in FEATURES_JS)
    sw = ("<script>if('serviceWorker' in navigator&&location.protocol==='https:')addEventListener('load',()=>"
          "navigator.serviceWorker.register('sw.js').catch(()=>null))</script>")
    return html.replace(old, f'</script><link rel="stylesheet" href="assets/features.css?v={v}"><link rel="stylesheet" href="assets/insights.css?v={v}">{js}{sw}</body></html>')


INDEX = _x_feat_index(INDEX)
# ======================== نهاية إضافة ملفات الميزات ========================
