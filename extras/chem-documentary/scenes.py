"""The ten scenes. Each draw(F, t, d, B) paints scene-local time t (s) of duration d; B maps beat names to times."""
import json, math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from gfx import *

ARCH_DIR = os.environ.get('ARCHIVE_DIR', os.path.join(HERE, 'archive'))
SUB_TOP = 958   # the subtitle band (render.py) starts here; nothing else is drawn below it
NAME = os.environ.get('DOC_NAME', 'زكريا أحمد العي')
CLASS = os.environ.get('DOC_CLASS', 'الفصل 302')


# ---------- shared pieces ----------

def _bg_gradient(c1, c2):
    y = np.linspace(0, 1, H)[:, None, None]
    x = np.linspace(0, 1, W)[None, :, None]
    k = np.clip(0.65 * y + 0.35 * (1 - x), 0, 1)
    arr = (np.array(c1) * (1 - k) + np.array(c2) * k)
    # vignette
    yy, xx = np.mgrid[0:H, 0:W]
    v = 1 - 0.45 * (((xx - W / 2) / (W / 1.6)) ** 2 + ((yy - H / 2) / (H / 1.4)) ** 2)
    arr = arr * np.clip(v, 0.4, 1)[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert('RGBA')


_BG = {}


def background(theme):
    if theme not in _BG:
        _BG[theme] = _bg_gradient(*{'navy': ((14, 22, 48), (4, 6, 16)), 'teal': ((8, 40, 46), (3, 8, 14)),
                                    'violet': ((32, 16, 52), (6, 4, 14)), 'amber': ((48, 30, 10), (8, 5, 3)),
                                    'paper': ((60, 58, 54), (14, 13, 12))}[theme])
    return _BG[theme]


_RND = random.Random(11)
PARTS = [(_RND.random(), _RND.random(), _RND.random(), _RND.choice((TEAL, BLUE, PINK, AMBER))) for _ in range(46)]


def particles(F, t, alpha=0.5, speed=1.0):
    for px, py, pz, col in PARTS:
        r = int(6 + 30 * pz)
        x = (px * W + 30 * math.sin(t * 0.4 + pz * 9) + t * 12 * speed * (0.3 + pz)) % (W + 80) - 40
        y = (py * H - t * 20 * speed * (0.2 + pz)) % (H + 80) - 40
        put(F, glow(r, col), x, y, alpha=alpha * (0.25 + 0.5 * pz))


def chip(F, idx, title, t):
    """Section label, top right, slides in."""
    k = ease_out(clamp01(t / 0.45))
    x = W - 70 + (1 - k) * 420
    im = text_img(title, 44, WHITE, 800)
    num = text_img(f'{idx:02d}', 44, TEAL, 800, rtl=False)
    w = im.width + num.width + 40
    rounded(F, (x - w, 52, x, 52 + 78), 22, (10, 16, 34, 200), TEAL + (255,), 2, alpha=k)
    put(F, num, x - 14, 91, 'rm', k)
    put(F, im, x - num.width - 18, 91, 'rm', k)


def caption(F, s, t0, t, y=930, size=50, color=WHITE, dur=None, box=True):
    """Lower caption that pops in at t0 (and out after dur)."""
    if t < t0:
        return
    y = min(y, SUB_TOP - 40)
    a = ease(clamp01((t - t0) / 0.25))
    if dur is not None:
        a *= 1 - ease(clamp01((t - t0 - dur) / 0.25))
    if a <= 0:
        return
    im = text_img(s, size, color, 700)
    if box:
        rounded(F, (W / 2 - im.width / 2 - 30, y - im.height / 2 - 6, W / 2 + im.width / 2 + 30, y + im.height / 2 + 6), 18,
                (0, 0, 0, 150), alpha=a)
    put(F, im, W / 2, y + (1 - a) * 18, alpha=a)


def pop(t, t0, dur=0.35):
    return ease_out(clamp01((t - t0) / dur))


def card(F, cx, cy, w, h, title, sub, col, k, title_size=54, sub_size=34, icon=None):
    if k <= 0:
        return
    y = cy + (1 - k) * 60
    rounded(F, (cx - w / 2, y - h / 2, cx + w / 2, y + h / 2), 26, (12, 18, 38, 215), col + (255,), 3, alpha=min(1, k))
    if icon:
        icon(F, cx, y - h / 2 + 95, min(1, k))
    ty = y - (h / 2 - (190 if icon else 70))
    text(F, title, cx, ty, title_size, col, alpha=min(1, k), weight=800)
    yy = ty + title_size * 0.95
    for line in sub.split('\n'):
        text(F, line, cx, yy + sub_size * 0.6, sub_size, WHITE, alpha=min(1, k), weight=500)
        yy += sub_size * 1.35


# candidates checked by eye (fetch_archive.py keeps up to three per slot)
PICK = {'archive_curie_1.jpg', 'archive_mendeleev_1.png', 'archive_solvay_1.jpg', 'portrait_razi_1.JPG',
        'portrait_lavoisier_1.jpg', 'portrait_mendeleev_2.jpg', 'portrait_curie_1.jpg'}


def archive_items():
    p = os.path.join(ARCH_DIR, 'archive.json')
    if not os.path.exists(p):
        return []
    items = [i for i in json.load(open(p, encoding='utf-8')) if os.path.exists(os.path.join(ARCH_DIR, i['file']))]
    arch = [i for i in items if i.get('slot', 'archive').startswith('archive')]
    # one photo per archive slot: the hand-checked pick when present, else the first candidate
    out = []
    for slot in ('archive_curie', 'archive_mendeleev', 'archive_solvay'):
        c = [i for i in arch if i.get('slot') == slot]
        c.sort(key=lambda i: i['file'] not in PICK)
        out += c[:1]
    return out or arch[:3]


def portrait(slot):
    p = os.path.join(ARCH_DIR, 'archive.json')
    if not os.path.exists(p):
        return None
    c = [i for i in json.load(open(p, encoding='utf-8')) if i.get('slot') == slot and os.path.exists(os.path.join(ARCH_DIR, i['file']))]
    c.sort(key=lambda i: i['file'] not in PICK)
    return c[0] if c else None


_PORT = {}


def portrait_img(name, w, h):
    key = (name, w, h)
    if key not in _PORT:
        im = Image.open(os.path.join(ARCH_DIR, name)).convert('RGB')
        im = ImageOps.fit(im, (w, h), Image.LANCZOS, centering=(0.5, 0.3))
        m = Image.new('L', (w, h), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], 22, fill=255)
        im = im.convert('RGBA'); im.putalpha(m)
        _PORT[key] = im
    return _PORT[key]


_IMG = {}


def arch_img(name, box_w, box_h):
    key = (name, box_w, box_h)
    if key not in _IMG:
        im = Image.open(os.path.join(ARCH_DIR, name)).convert('L')
        im = ImageOps.autocontrast(im, cutoff=1)
        if name.lower().endswith('.png'):
            bg = Image.new('L', (box_w, box_h), 236)
            im = ImageOps.contain(im, (box_w - 40, box_h - 40), Image.LANCZOS)
            bg.paste(im, ((box_w - im.width) // 2, (box_h - im.height) // 2))
            im = bg
        else:
            im = ImageOps.fit(im, (box_w, box_h), Image.LANCZOS, centering=(0.5, 0.4))
        _IMG[key] = im.convert('RGBA')
    return _IMG[key]


_GRAIN = [Image.fromarray(np.random.RandomState(k).normal(0, 18, (H // 2, W // 2)).clip(-60, 60).astype(np.int16).__add__(128).astype(np.uint8)).resize((W, H)) for k in range(6)]


def film(F, t, strength=0.35):
    g = _GRAIN[int(t * 24) % len(_GRAIN)]
    L = Image.merge('RGBA', (g, g, g, Image.new('L', (W, H), int(255 * strength * 0.35))))
    F.alpha_composite(L)


# ---------- icons ----------

def ic_bread(F, x, y, a, s=1.0):
    L = Image.new('RGBA', (int(260 * s), int(200 * s)), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    d.rounded_rectangle([10 * s, 60 * s, 250 * s, 190 * s], int(40 * s), fill=(214, 150, 70, 255))
    d.ellipse([10 * s, 10 * s, 250 * s, 130 * s], fill=(232, 170, 85, 255))
    for k in range(3):
        d.arc([(50 + 55 * k) * s, 30 * s, (100 + 55 * k) * s, 90 * s], 200, 330, fill=(150, 90, 40, 255), width=int(7 * s))
    put(F, L, x, y, alpha=a)


def ic_pill(F, x, y, a, s=1.0):
    L = Image.new('RGBA', (int(260 * s), int(130 * s)), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    d.rounded_rectangle([5 * s, 10 * s, 255 * s, 120 * s], int(55 * s), fill=(240, 240, 250, 255))
    d.rounded_rectangle([130 * s, 10 * s, 255 * s, 120 * s], int(55 * s), fill=PINK + (255,))
    d.rectangle([130 * s, 10 * s, 190 * s, 120 * s], fill=PINK + (255,))
    put(F, L.rotate(-25, expand=True, resample=Image.BICUBIC), x, y, alpha=a)


def ic_battery(F, x, y, a, s=1.0, charge=1.0):
    L = Image.new('RGBA', (int(150 * s), int(250 * s)), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    d.rounded_rectangle([50 * s, 0, 100 * s, 30 * s], int(8 * s), fill=(200, 210, 230, 255))
    d.rounded_rectangle([8 * s, 24 * s, 142 * s, 245 * s], int(22 * s), outline=(200, 210, 230, 255), width=int(9 * s))
    hgt = 200 * s * charge
    d.rounded_rectangle([24 * s, 230 * s - hgt, 126 * s, 230 * s], int(10 * s), fill=TEAL + (255,))
    put(F, L, x, y, alpha=a)


def ic_x(F, x, y, a, s=1.0, col=PINK):
    L = Image.new('RGBA', (int(120 * s), int(120 * s)), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    d.ellipse([4, 4, 120 * s - 4, 120 * s - 4], outline=col + (255,), width=int(8 * s))
    d.line([35 * s, 35 * s, 85 * s, 85 * s], fill=col + (255,), width=int(11 * s))
    d.line([85 * s, 35 * s, 35 * s, 85 * s], fill=col + (255,), width=int(11 * s))
    put(F, L, x, y, alpha=a)


def ic_ok(F, x, y, a, s=1.0, col=TEAL):
    L = Image.new('RGBA', (int(120 * s), int(120 * s)), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    d.ellipse([4, 4, 120 * s - 4, 120 * s - 4], outline=col + (255,), width=int(8 * s))
    d.line([(32 * s, 62 * s), (52 * s, 82 * s), (90 * s, 40 * s)], fill=col + (255,), width=int(11 * s), joint='curve')
    put(F, L, x, y, alpha=a)


# ---------- scenes ----------

def s01(F, t, d, B):
    F.alpha_composite(background('navy')); particles(F, t, 0.55, 1.6)
    A, Bo = mol_water()
    molecule(F, A, Bo, 1700, 860, 150, 0.35 + 0.3 * math.sin(t * 0.8), t * 1.3, alpha=0.12 + 0.88 * (1 - min(1, pop(t, B['kimya']))))
    for key, fn, x in (('bread', ic_bread, 1450), ('pill', ic_pill, 960), ('batt', ic_battery, 470)):
        k = pop(t, B[key]) * (1 - ease(clamp01((t - B['kimya']) / 0.4)))
        if k > 0:
            fn(F, x, 520 + (1 - k) * 80, min(1, k))
    k = pop(t, B['kimya'], 0.5)
    if k > 0:
        text(F, 'الكيمياء', W / 2, 430, 210, WHITE, alpha=min(1, k), scale=0.7 + 0.3 * k, weight=900)
        text(F, 'علم المادة: مِمَّ تتكوّن؟ وكيف تتغيّر؟', W / 2, 640, 64, TEAL, alpha=ease(clamp01((t - B['kimya'] - 0.4) / 0.4)))
        flask(F, W / 2, 905, 62, mix(TEAL, PINK, 0.5 + 0.5 * math.sin(t * 1.5)), 0.45, t, bubbles=10, alpha=ease(clamp01((t - B['kimya'] - 0.6) / 0.4)))


def _ill_lab(F, x, y, w, h, t):
    """Black-and-white line drawing of an old laboratory bench (illustration, not a photograph)."""
    L = Image.new('RGBA', (w, h), (205, 200, 188, 255)); d = ImageDraw.Draw(L)
    ink = (40, 38, 36, 255)
    d.rectangle([0, int(h * 0.72), w, int(h * 0.76)], fill=ink)
    for i, cx in enumerate((0.18, 0.42, 0.66, 0.86)):
        bx = int(cx * w)
        if i % 2 == 0:
            d.ellipse([bx - 70, int(h * 0.45), bx + 70, int(h * 0.71)], outline=ink, width=5)
            d.line([bx + 40, int(h * 0.48), bx + 170, int(h * 0.30)], fill=ink, width=6)
        else:
            d.polygon([(bx - 20, int(h * 0.38)), (bx + 20, int(h * 0.38)), (bx + 75, int(h * 0.71)), (bx - 75, int(h * 0.71))], outline=ink, width=5)
    for k in range(9):
        d.rectangle([60 + k * (w - 120) // 9, int(h * 0.12), 60 + k * (w - 120) // 9 + 50, int(h * 0.28)], outline=ink, width=4)
    d.line([0, int(h * 0.30), w, int(h * 0.30)], fill=ink, width=5)
    return L


def _ill_table(w, h):
    """Re-drawing of the layout idea of Mendeleev's 1869 table: element symbols in columns by atomic weight."""
    L = Image.new('RGBA', (w, h), (214, 207, 190, 255)); d = ImageDraw.Draw(L)
    cols = [['Ti', 'V', 'Cr', 'Mn', 'Fe', 'Ni', 'Cu', 'Zn', '?', '?', 'As', 'Se', 'Br', 'Rb', 'Sr'],
            ['Zr', 'Nb', 'Mo', 'Rh', 'Ru', 'Pd', 'Ag', 'Cd', 'U', 'Sn', 'Sb', 'Te', 'I', 'Cs', 'Ba'],
            ['H', 'Be', 'B', 'C', 'N', 'O', 'F', 'Li', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'K', 'Ca']]
    f = font(30, 500, 'NotoNaskh')
    for ci, col in enumerate(cols):
        for ri, s in enumerate(col[:13]):
            d.text((90 + ci * 230, 40 + ri * ((h - 80) / 13)), s, font=f, fill=(40, 36, 32, 255))
    for k in range(4):
        d.line([60 + k * 230, 30, 60 + k * 230, h - 30], fill=(80, 72, 62, 255), width=2)
    return L


def s02(F, t, d, B):
    F.alpha_composite(background('paper'))
    items = archive_items()
    beats = [B['curie'], B['mend'], B['solvay']]
    n = len(items)
    if n:
        # real archive photographs (downloaded by fetch_archive.py), Ken Burns + grain
        starts = ([0.0, B['mend'] - 0.25, B['solvay'] - 0.25] + [d] * 9)[:n]   # photo changes as the narration names each one
        i = max(k for k in range(n) if t >= starts[k])
        seg = (starts[i + 1] if i + 1 < n else d) - starts[i]
        lt = t - starts[i]
        it = items[i]
        im = arch_img(it['file'], 1500, 760)
        z = 1.0 + 0.07 * lt / seg
        k = ease(clamp01(lt / 0.3))
        put(F, im, W / 2 + 30 * (lt / seg - .5) * (1 if i % 2 else -1), 480, alpha=k, scale=z)
        caption(F, it['caption'], starts[i] + 0.15, t, y=905, size=44)
        text(F, f"{it.get('title', '')[5:]} · {it.get('license', '')} · Wikimedia Commons", 40, 30, 22, (200, 200, 200),
             anchor='lt', alpha=k * 0.9, weight=500, rtl=False)
    else:
        # no photographs available: labelled illustrations, never presented as real photos
        idx = 0 if t < beats[1] else (1 if t < beats[2] else 2)
        lt = t - (0, beats[1], beats[2])[idx]
        k = ease(clamp01(lt / 0.3))
        if idx == 0:
            put(F, _ill_lab(F, 0, 0, 1500, 820, t), W / 2, 520, alpha=k, scale=1 + 0.04 * lt)
            caption(F, 'مختبر قديم', 0, lt, y=975, size=48)
        elif idx == 1:
            put(F, _ill_table(1300, 820), W / 2, 520, alpha=k, scale=1 + 0.04 * lt)
            caption(F, 'فكرة جدول مندلييف (1869)', 0, lt, y=975, size=48)
        else:
            rounded(F, (260, 160, 1660, 880), 10, (200, 196, 186, 255), alpha=k)
            for r in range(3):
                for c in range(9):
                    cx, cy = 400 + c * 140 + (70 if r % 2 else 0), 360 + r * 150
                    put(F, glow(52, (50, 48, 46)), cx, cy, alpha=k * 0.95)
            text(F, 'مؤتمر سولفاي 1927 — بروكسل', W / 2, 800, 52, (40, 38, 36), alpha=k, rtl=True)
        text(F, 'رسم توضيحي — ليست صورة أرشيفية', 40, 30, 26, (230, 230, 230), anchor='lt', alpha=0.9, weight=600)
    film(F, t, 0.45)
    chip(F, 2, 'من الأرشيف', t)


def _alembic(F, t, x, y, s, a, k_fill):
    flame(F, x - 2.1 * s, y + 0.55 * s, s * 0.9, t, a)
    L = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    glass = (220, 235, 255, 230)
    bx, by, r = x - 2.1 * s, y - 0.9 * s, 0.85 * s
    d.ellipse([bx - r, by - r, bx + r, by + r], fill=(120, 200, 140, 150), outline=glass, width=5)
    d.line([(bx, by - r), (bx, by - r - 0.5 * s), (bx + 0.4 * s, by - r - 0.75 * s), (x + 1.7 * s, y - 0.9 * s)], fill=glass, width=8, joint='curve')
    rx, ry = x + 1.9 * s, y
    d.polygon([(rx - 0.55 * s, ry - 1.1 * s), (rx + 0.55 * s, ry - 1.1 * s), (rx + 0.65 * s, ry), (rx - 0.65 * s, ry)], outline=glass, width=5)
    lvl = 0.9 * s * k_fill
    d.polygon([(rx - 0.62 * s, ry - lvl), (rx + 0.62 * s, ry - lvl), (rx + 0.65 * s, ry), (rx - 0.65 * s, ry)], fill=(120, 210, 255, 170))
    for j in range(3):
        ph = (t * 1.6 + j / 3) % 1
        dy = y - 0.9 * s + ph * (0.9 * s - lvl + 0.1 * s)
        d.ellipse([x + 1.7 * s - 6, dy - 9, x + 1.7 * s + 6, dy + 9], fill=(150, 220, 255, 230))
    put(F, L, 0, 0, 'lt', a)


def s03(F, t, d, B):
    F.alpha_composite(background('teal')); particles(F, t, 0.35)
    chip(F, 3, 'التعريف وجابر بن حيان', t)
    if t < B['etym']:
        k = pop(t, 0.2)
        text(F, 'الكيمياء', W / 2, 330, 120, TEAL, alpha=min(1, k), weight=900)
        for j, w in enumerate(('تركيب المادة', 'خصائصها', 'تفاعلاتها')):
            kk = pop(t, 0.8 + j * 0.55)
            card(F, W / 2 + (1 - j) * 520, 640, 440, 170, w, '', (TEAL, AMBER, PINK)[j], kk, title_size=58)
    elif t < B['jabir']:
        lt = t - B['etym']
        words = [('الكيمياء', 'ar'), ('alchemy', 'en'), ('chemistry', 'en')]
        for j, (w, lang) in enumerate(words):
            kk = pop(lt, 0.15 + j * 0.9)
            x = W - 330 - j * 630
            rounded(F, (x - 250, 430, x + 250, 610), 30, (12, 18, 38, 220), (TEAL, AMBER, BLUE)[j] + (255,), 3, alpha=min(1, kk))
            text(F, w, x, 520, 84, WHITE, alpha=min(1, kk), rtl=(lang == 'ar'), weight=800)
            if j:
                arrow(F, x + 375, 520, x + 260, 520, GREY, 8, alpha=min(1, kk))
    else:
        lt = t - B['jabir']
        k = pop(lt, 0.0)
        rounded(F, (1010, 230, 1800, 760), 30, (12, 18, 38, 220), AMBER + (255,), 3, alpha=min(1, k))
        text(F, 'جابر بن حيّان', 1405, 330, 86, AMBER, alpha=min(1, k), weight=900)
        text(F, 'القرن الثامن الميلادي (العصر العباسي)', 1405, 440, 42, WHITE, alpha=min(1, k), weight=600)
        text(F, 'لُقِّب بأبي الكيمياء — عُرف لاتينيًا باسم Geber', 1405, 520, 34, GREY, alpha=min(1, k), weight=500)
        text(F, 'لا توجد له صورة حقيقية', 1405, 690, 30, GREY, alpha=min(1, k) * 0.9, weight=500)
        _alembic(F, t, 520, 700, 150, min(1, pop(lt, 0.3)), clamp01((lt - 0.5) / max(1, d - B['jabir'])))
        for j, w in enumerate(('التقطير', 'التبلور', 'التسامي')):
            kk = pop(t, B['taqtir'] + j * 0.55)
            rounded(F, (1010 + j * 270, 800, 1260 + j * 270, 890), 22, (12, 18, 38, 220), TEAL + (255,), 2, alpha=min(1, kk))
            text(F, w, 1135 + j * 270, 845, 44, WHITE, alpha=min(1, kk))
        kk = pop(t, B['muarrikh'])
        if kk > 0:
            text(F, 'يرى مؤرخون أن أتباعه كتبوا بعض كتبه', 1405, 610, 32, AMBER, alpha=min(1, kk), weight=600)


BR = [('العضوية', TEAL), ('غير العضوية', BLUE), ('الفيزيائية', AMBER), ('التحليلية', PINK), ('الحيوية', (150, 230, 120))]


def s04(F, t, d, B):
    F.alpha_composite(background('violet')); particles(F, t, 0.35)
    chip(F, 4, 'فروع الكيمياء', t)
    cx, cy = W / 2, 560
    L = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(L)
    pts = []
    for j, (name, col) in enumerate(BR):
        a = math.radians(90 + 72 * j)
        px, py = cx + 560 * math.cos(a) * 1.05, cy - 330 * math.sin(a)
        pts.append((px, py))
        k = clamp01((t - B[f'b{j}']) / 0.3)
        if k > 0:
            dr.line([(cx, cy), (lerp(cx, px, ease(k)), lerp(cy, py, ease(k)))], fill=col + (220,), width=6)
    F.alpha_composite(L)
    rounded(F, (cx - 190, cy - 75, cx + 190, cy + 75), 75, (12, 18, 38, 240), WHITE + (255,), 3)
    text(F, 'الكيمياء', cx, cy, 70, WHITE, weight=900)
    for j, (name, col) in enumerate(BR):
        k = pop(t, B[f'b{j}'] + 0.15)
        if k > 0:
            px, py = pts[j]
            im = text_img(name, 56, col, 800)
            rounded(F, (px - im.width / 2 - 34, py - 58, px + im.width / 2 + 34, py + 58), 40, (12, 18, 38, 235), col + (255,), 3, alpha=min(1, k))
            put(F, im, px, py, alpha=min(1, k), scale=0.8 + 0.2 * min(1, k))


def s05(F, t, d, B):
    F.alpha_composite(background('navy')); particles(F, t, 0.3)
    chip(F, 5, 'أهم ثلاثة فروع', t)
    part = 0 if t < B['inorg'] else (1 if t < B['bio'] else 2)
    t0 = (0, B['inorg'], B['bio'])[part]
    lt = t - t0
    k = pop(lt, 0.0, 0.4)
    num = ('1', '2', '3')[part]
    name, col = (BR[0], BR[1], BR[4])[part]
    text(F, num, 1790, 300, 190, col, alpha=min(1, k) * 0.9, rtl=False, weight=900)
    text(F, 'الكيمياء ' + name, 1690, 300, 92, WHITE, anchor='rm', alpha=min(1, k), weight=900)
    if part == 0:
        A, Bo = mol_aspirin()
        molecule(F, A, Bo, 500, 570, 80 * min(1, k), 0.25 * math.sin(t), t * 0.9)
        text(F, 'جزيء الأسبرين C₉H₈O₄', 520, 905, 44, GREY, alpha=min(1, k), weight=600)
        for j, w in enumerate(('مركّبات الكربون', 'الأدوية', 'البلاستيك')):
            caption_box(F, w, 1330, 500 + j * 130, pop(t, B[('org_c', 'org_d', 'org_p')[j]]), col)
    elif part == 1:
        A, Bo = mol_nacl(3)
        molecule(F, A, Bo, 500, 570, 100 * min(1, k), 0.5 + 0.2 * math.sin(t), t * 0.7)
        text(F, 'بلّورة ملح الطعام NaCl', 520, 905, 44, GREY, alpha=min(1, k), weight=600)
        for j, w in enumerate(('الفلزات', 'الأملاح والمعادن', 'كلوريد الصوديوم NaCl')):
            caption_box(F, w, 1330, 500 + j * 130, pop(t, B[('in_m', 'in_s', 'in_n')[j]]), col)
    else:
        A, Bo = mol_dna(15)
        molecule(F, A, Bo, 520, 570, 70 * min(1, k), 0.15, t * 1.2)
        text(F, 'الحمض النووي DNA', 520, 905, 44, GREY, alpha=min(1, k), weight=600)
        for j, w in enumerate(('كيمياء الكائنات الحية', 'الإنزيمات تهضم الطعام', 'DNA يحمل الصفات الوراثية')):
            caption_box(F, w, 1330, 500 + j * 130, pop(t, B[('bio_l', 'bio_e', 'bio_d')[j]]), col)


def caption_box(F, s, x, y, k, col):
    if k <= 0:
        return
    im = text_img(s, 52, WHITE, 700)
    a = min(1, k)
    xx = x + (1 - k) * 120
    rounded(F, (xx - 380, y - 52, xx + 380, y + 52), 26, (12, 18, 38, 220), col + (255,), 2, alpha=a)
    put(F, im, xx, y, alpha=a)


def s06(F, t, d, B):
    F.alpha_composite(background('amber')); particles(F, t, 0.25)
    chip(F, 6, 'الكيمياء في حياتك', t)
    tiles = [('soap', 'الصابون', 'طرف يحب الماء وطرف يحب الدهن'), ('rust', 'الصدأ', 'الحديد + الأكسجين + الماء'),
             ('bread', 'قشرة الخبز', 'تفاعل مايار'), ('batt', 'البطارية', 'من طاقة كيميائية إلى كهرباء')]
    cur = max([j for j, tl in enumerate(tiles) if t >= B[tl[0]] - 0.1] or [0])
    for j, (key, title, sub) in enumerate(tiles):
        k = pop(t, B[key] - 0.1)
        if k <= 0:
            continue
        cx = W - 290 - j * 447
        foc = 1.0 if j == cur else 0.55
        y0 = 590
        rounded(F, (cx - 205, y0 - 330, cx + 205, y0 + 330), 30, (20, 14, 8, 210), (AMBER if j == cur else GREY) + (255,), 3, alpha=min(1, k))
        text(F, title, cx, y0 + 180, 58, AMBER if j == cur else WHITE, alpha=min(1, k), weight=800)
        text(F, sub, cx, y0 + 260, 28 if len(sub) > 22 else 32, WHITE, alpha=min(1, k) * foc, weight=500)
        a = min(1, k) * (0.6 + 0.4 * foc)
        if key == 'soap':
            _soap_small(F, cx, y0 - 80, t, a)
        elif key == 'rust':
            _rust_small(F, cx, y0 - 80, t, a, clamp01((t - B['rust']) / 3))
        elif key == 'bread':
            ic_bread(F, cx, y0 - 80, a, 1.2)
            k2 = clamp01((t - B['bread']) / 2.5)
            put(F, glow(120, (120, 60, 10)), cx, y0 - 100, alpha=a * k2 * 0.7)
        else:
            ic_battery(F, cx, y0 - 80, a, 1.0, 0.25 + 0.75 * clamp01((t - B['batt']) / 2.5))


def _soap_small(F, x, y, t, a):
    put(F, glow(80, AMBER), x, y, alpha=a * 0.9)
    L = Image.new('RGBA', (420, 420), (0, 0, 0, 0)); dr = ImageDraw.Draw(L)
    c = 210
    for j in range(14):
        ang = j * 2 * math.pi / 14 + t * 0.5
        dr.line([(c + 50 * math.cos(ang), c + 50 * math.sin(ang)), (c + 120 * math.cos(ang), c + 120 * math.sin(ang))], fill=(235, 235, 235, 255), width=5)
        hx, hy = c + 135 * math.cos(ang), c + 135 * math.sin(ang)
        dr.ellipse([hx - 16, hy - 16, hx + 16, hy + 16], fill=BLUE + (255,))
    put(F, L, x, y, alpha=a)


def _rust_small(F, x, y, t, a, k):
    col = mix((160, 165, 175), (165, 70, 30), k)
    rounded(F, (x - 150, y - 45, x + 150, y + 45), 12, col + (255,), alpha=a)
    rnd = random.Random(5)
    for j in range(int(26 * k)):
        put(F, glow(10 + rnd.randint(0, 12), (185, 80, 30)), x + rnd.uniform(-140, 140), y + rnd.uniform(-36, 36), alpha=a * 0.8)
    text(F, 'Fe + O₂ + H₂O', x, y + 100, 34, WHITE, alpha=a, rtl=False, weight=600)


SCI = [('razi', 'أبو بكر الرازي', 'تُوفّي نحو 925م', 'صنّف المواد\nووصف أدوات المختبر', AMBER),
       ('lav', 'أنطوان لافوازييه', '1743–1794', 'صاغ قانون\nحفظ الكتلة', BLUE),
       ('mend', 'ديمتري مندلييف', '1834–1907', 'الجدول الدوري\nوتنبّأ بعناصر جديدة', TEAL),
       ('curie', 'ماري كوري', '1867–1934', 'البولونيوم والراديوم\nأول من فاز بنوبل مرتين', PINK)]


PSLOT = ('razi', 'lavoisier', 'mendeleev', 'curie')
PNOTE = ('مخطوطة لاتينية، نحو 1250م', 'نقش قديم', 'صورة فوتوغرافية', 'صورة نحو 1920')


def s07(F, t, d, B):
    F.alpha_composite(background('navy')); particles(F, t, 0.3)
    chip(F, 7, 'أشهر العلماء', t)
    cur = max([j for j, s in enumerate(SCI) if t >= B[s[0]] - 0.1] or [0])
    for j, (key, name, yrs, what, col) in enumerate(SCI):
        k = pop(t, B[key] - 0.1)
        cx = W - 280 - j * 453
        big = 1.0 if j == cur else 0.0
        if k <= 0:
            continue
        y = 600 - 25 * big
        rounded(F, (cx - 210, y - 330, cx + 210, y + 330), 30, (12, 18, 38, 225), (col if j == cur else GREY) + (255,), 3 + 2 * big, alpha=min(1, k))
        pi = portrait('portrait_' + PSLOT[j])
        if pi:
            put(F, glow(170, col), cx, y - 165, alpha=min(1, k) * 0.35 * (0.5 + 0.5 * big))
            put(F, portrait_img(pi['file'], 330, 330), cx, y - 165, alpha=min(1, k))
            if PNOTE[j]:
                text(F, PNOTE[j], cx, y + 36, 24, GREY, alpha=min(1, k), weight=500)
        else:
            put(F, glow(95, col), cx, y - 150, alpha=min(1, k) * (0.5 + 0.5 * big))
            text(F, ('ر', 'ل', 'م', 'ك')[j], cx, y - 155, 110, WHITE, alpha=min(1, k), weight=900)
        text(F, name, cx, y + 85, 44, col, alpha=min(1, k), weight=900)
        text(F, yrs, cx, y + 140, 34, GREY, alpha=min(1, k), weight=600, rtl=(j == 0))
        for li, line in enumerate(what.split('\n')):
            text(F, line, cx, y + 205 + li * 50, 33, WHITE, alpha=min(1, k), weight=600)
    if any(portrait('portrait_' + p) for p in PSLOT):
        text(F, 'الصور: Wikimedia Commons (ملكية عامة)', 40, 30, 22, GREY, anchor='lt', alpha=0.85, weight=500)


def _medal(F, x, y, r, t, a):
    if r < 4:
        return
    put(F, glow(int(r * 1.6), GOLD), x, y, alpha=a * 0.45)
    put(F, sphere(GOLD, r), x, y, alpha=a)
    text(F, 'نوبل', x, y - 10, int(r * 0.45), (90, 60, 10), alpha=a, weight=900)
    text(F, 'كيمياء', x, y + r * 0.38, int(r * 0.2), (90, 60, 10), alpha=a, weight=800)


def s08(F, t, d, B):
    F.alpha_composite(background('amber')); particles(F, t, 0.3)
    chip(F, 8, 'جائزة نوبل في الكيمياء', t)
    k = pop(t, 0.1, 0.5)
    _medal(F, 430, 560, int(230 * min(1, k)), t, min(1, k))
    rows = [('y1901', 'منذ 1901', 'تمنحها الأكاديمية الملكية السويدية للعلوم', WHITE),
            ('vh', "أول فائز: فانت هوف (هولندا) 1901", 'عن قوانين الديناميكا الكيميائية والضغط الأسموزي', AMBER),
            ('zew', 'أحمد زويل — 1999', 'كيمياء الفيمتو ثانية: رصد التفاعلات لحظة حدوثها', TEAL),
            ('yag', 'عمر ياغي — 2025', 'الأطر الفلزية العضوية (بالاشتراك مع كيتاغاوا وروبسون)', PINK)]
    for j, (key, h, sub, col) in enumerate(rows):
        kk = pop(t, B[key])
        if kk <= 0:
            continue
        y = 300 + j * 175
        x = 1820 + (1 - min(1, kk)) * 200
        rounded(F, (x - 1050, y - 75, x, y + 75), 26, (20, 14, 8, 215), col + (255,), 2, alpha=min(1, kk))
        text(F, h, x - 40, y - 24, 52, col, anchor='rm', alpha=min(1, kk), weight=800)
        text(F, sub, x - 40, y + 38, 32, WHITE, anchor='rm', alpha=min(1, kk), weight=500)


def s09(F, t, d, B):
    F.alpha_composite(background('violet')); particles(F, t, 0.25)
    chip(F, 9, 'خرافات الخيمياء', t)
    part = 0 if t < B['m1'] else (1 if t < B['m2'] else (2 if t < B['m3'] else 3))
    if part == 0:
        k = pop(t, 0.1)
        text(F, 'خرافة أم حقيقة؟', W / 2, 500, 140, WHITE, alpha=min(1, k), weight=900, scale=0.8 + 0.2 * min(1, k))
        ic_x(F, W / 2 + 720, 500, min(1, pop(t, 0.5)), 1.4)
        ic_ok(F, W / 2 - 720, 500, min(1, pop(t, 0.8)), 1.4)
        return
    lt = t - (B['m1'], B['m2'], B['m3'])[part - 1]
    k = min(1, pop(lt, 0))
    myth = ('تحويل الرصاص إلى ذهب', 'إكسير الحياة', 'العالم من أربعة عناصر فقط')[part - 1]
    tw = text_img('خرافة: ' + myth, 50, WHITE, 800).width
    rounded(F, (1660 - tw - 40, 200, 1820, 330), 30, (40, 10, 24, 220), PINK + (255,), 3, alpha=k)
    ic_x(F, 1740, 265, k, 0.8)
    text(F, 'خرافة: ' + myth, 1660, 265, 50, WHITE, anchor='rm', alpha=k, weight=800)
    tk = min(1, pop(t, (B['f1'], B['f2'], B['f3'])[part - 1]))
    if part == 1:
        for j, (sym, z, col, x) in enumerate((('Pb', 82, (140, 150, 170), 1470), ('Au', 79, GOLD, 450))):
            put(F, glow(170, col), x, 560, alpha=0.35 * k)
            put(F, sphere(col, 120), x, 560, alpha=k)
            text(F, sym, x, 545, 110, (20, 20, 30), alpha=k, rtl=False, weight=900)
            text(F, f'{z} بروتونًا', x, 760, 54, WHITE, alpha=k, weight=800)
        arrow(F, 1290, 560, 640, 560, GREY, 10, alpha=k)
        ic_x(F, 960, 560, k, 0.9)
        text(F, 'التحويل ممكن نوويًا فقط، بكميات ضئيلة وكلفة هائلة', W / 2, 835, 34, GREY, alpha=tk * 0.9, weight=500)
        caption(F, 'هوية العنصر = عدد البروتونات في نواته', B['f1'], t, y=905, size=46)
    elif part == 2:
        flask(F, 560, 820, 120, (200, 60, 255), 0.5, t, bubbles=12, seed=3, alpha=k)
        put(F, glow(70, (200, 210, 230)), 1400, 600, alpha=tk)
        put(F, sphere((200, 205, 215), 70), 1400, 600, alpha=tk)
        text(F, 'Hg', 1400, 595, 64, (30, 30, 40), alpha=tk, rtl=False, weight=900)
        text(F, 'زئبق سامّ', 1400, 730, 54, PINK, alpha=tk, weight=800)
    else:
        names = (('نار', (255, 110, 50)), ('ماء', BLUE), ('هواء', (200, 220, 240)), ('تراب', (170, 120, 70)))
        fade = 1 - ease(clamp01((t - B['f3']) / 0.5))
        for j, (n, col) in enumerate(names):
            x = 1500 - j * 330
            put(F, glow(110, col), x, 560, alpha=k * fade * 0.8)
            text(F, n, x, 560, 64, WHITE, alpha=k * fade, weight=800)
        if t >= B['f3']:
            periodic(F, 435, 372, 54, clamp01((t - B['f3']) / 1.2), alpha=1)
            kk = pop(t, B['f3'] + 0.3)
            text(F, '118', 560, 262, 110, GOLD, alpha=min(1, kk), rtl=False, weight=900)
            text(F, 'عنصرًا معروفًا اليوم', 330, 262, 46, WHITE, anchor='rm', alpha=min(1, kk), weight=700)


def s10(F, t, d, B):
    F.alpha_composite(background('navy')); particles(F, t, 0.6, 0.7)
    k = pop(t, 0.05, 0.5)
    text(F, 'الكيمياء ليست سحرًا… بل علمٌ يفسّر العالم', W / 2, 250, 66, TEAL, alpha=min(1, k) * (1 - ease(clamp01((t - B['thanks']) / 0.4)) * 0.5), weight=800)
    k2 = pop(t, B['thanks'], 0.5)
    if k2 > 0:
        text(F, 'شكرًا على المتابعة', W / 2, 430, 150, WHITE, alpha=min(1, k2), scale=0.75 + 0.25 * min(1, k2), weight=900)
        k3 = ease(clamp01((t - B['thanks'] - 0.5) / 0.5))
        text(F, 'إعداد', W / 2, 590, 44, GREY, alpha=k3, weight=600)
        text(F, NAME, W / 2, 685, 92, AMBER, alpha=k3, weight=800, family='Amiri-Bold')
        text(F, CLASS, W / 2, 790, 52, WHITE, alpha=k3, weight=700)
        credit = 'التعليق الصوتي: صوت عربي مُولَّد بالذكاء الاصطناعي (Piper)  •  الموسيقى: مولَّدة برمجيًا'
        if archive_items():
            credit += '  •  الصور الأرشيفية: Wikimedia Commons (ملكية عامة)'
        text(F, credit, W / 2, 890, 26, GREY, alpha=k3 * 0.9, weight=500)


SCENES = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10]

# beats: phrase (as written in script.json, without tashkeel matching) -> time, by character position
BEATS = {
    's01': {'bread': 'رَغِيفِ', 'pill': 'حَبَّةِ', 'batt': 'بَطَّارِيَّةِ', 'kimya': 'إِنَّهَا'},
    's02': {'curie': 'مُخْتَبَرُ', 'mend': 'جَدْوَلُ', 'solvay': 'مُؤْتَمَرُ'},
    's03': {'etym': 'وَقَدْ دَخَلَ', 'jabir': 'وَفِي الْعَصْرِ', 'taqtir': 'التَّقْطِيرِ', 'muarrikh': 'وَيَرَى'},
    's04': {'b0': 'الْعُضْوِيَّةُ', 'b1': 'وَغَيْرُ', 'b2': 'وَالْفِيزِيَائِيَّةُ', 'b3': 'وَالتَّحْلِيلِيَّةُ', 'b4': 'وَالْحَيَوِيَّةُ'},
    's05': {'org_c': 'كِيمِيَاءُ مُرَكَّبَاتِ', 'org_d': 'الْأَدْوِيَةُ', 'org_p': 'وَالْبْلَاسْتِيك', 'inorg': 'ثَانِيًا',
            'in_m': 'وَتَدْرُسُ الْمَعَادِنَ', 'in_s': 'وَالْأَمْلَاحَ', 'in_n': 'كَمِلْحِ', 'bio': 'ثَالِثًا',
            'bio_l': 'وَتَدْرُسُ الْكَائِنَاتِ', 'bio_e': 'كَالْإِنْزِيمَاتِ', 'bio_d': 'وَالْحَمْضِ'},
    's06': {'soap': 'الصَّابُونُ', 'rust': 'وَالْحَدِيدُ', 'bread': 'وَقِشْرَةُ', 'batt': 'وَبَطَّارِيَّةُ'},
    's07': {'razi': 'أَبُو بَكْرٍ', 'lav': 'وَأَنْطْوَانْ', 'mend': 'وَدِيمِتْرِي', 'curie': 'وَمَارِي'},
    's08': {'y1901': 'مُنْذُ عَامِ', 'vh': 'وَأَوَّلُ', 'zew': 'وَمِنَ الْعَرَبِ', 'yag': 'وَعُمَرُ'},
    's09': {'m1': 'أَوَّلًا', 'f1': 'وَالْحَقِيقَةُ', 'm2': 'ثَانِيًا', 'f2': 'وَلَا مَادَّةَ', 'm3': 'ثَالِثًا', 'f3': 'وَنَحْنُ نَعْرِفُ'},
    's10': {'thanks': 'شُكْرًا'},
}
