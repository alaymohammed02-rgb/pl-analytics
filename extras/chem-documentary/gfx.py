"""Drawing helpers for the chemistry documentary: Arabic text, sprites, molecules, lab glassware."""
import math, os, random
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.environ.get('FONT_DIR', os.path.join(HERE, 'fonts'))

BG = (9, 14, 30)
TEAL = (46, 230, 197)
AMBER = (255, 184, 77)
PINK = (255, 93, 143)
BLUE = (77, 163, 255)
WHITE = (240, 244, 255)
GREY = (150, 160, 185)
GOLD = (236, 190, 80)


def ease(x):          # smooth in-out
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def ease_out(x):      # fast start, soft landing (a little overshoot)
    x = min(max(x, 0.0), 1.0)
    c = 1.4
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def clamp01(x):
    return min(max(x, 0.0), 1.0)


def lerp(a, b, k):
    return a + (b - a) * k


def mix(c1, c2, k):
    return tuple(int(lerp(a, b, k)) for a, b in zip(c1, c2))


@lru_cache(None)
def font(size, weight=700, family='Cairo'):
    f = ImageFont.truetype(os.path.join(FONT_DIR, f'{family}.ttf'), size, layout_engine=ImageFont.Layout.RAQM)
    try:
        axes = f.get_variation_axes()
        f.set_variation_by_axes([weight if a['name'] in (b'Weight', 'Weight') else a['default'] for a in axes])
    except Exception:
        pass
    return f


@lru_cache(4096)
def text_img(s, size, color=WHITE, weight=700, family='Cairo', rtl=True, shadow=True):
    """Shaped text as a tight RGBA image (Arabic right-to-left through raqm)."""
    f = font(size, weight, family)
    kw = dict(direction='rtl', language='ar') if rtl else {}
    l, t, r, b = f.getbbox(s, **kw)
    pad = max(6, size // 6)
    im = Image.new('RGBA', (r - l + 2 * pad, b - t + 2 * pad), (0, 0, 0, 0))
    if shadow:
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((pad - l + 2, pad - t + 3), s, font=f, fill=(0, 0, 0, 170), **kw)
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(max(2, size // 18))))
    ImageDraw.Draw(im).text((pad - l, pad - t), s, font=f, fill=color + (255,), **kw)
    return im


def with_alpha(im, a):
    if a >= 0.999:
        return im
    im = im.copy()
    im.putalpha(im.getchannel('A').point(lambda v: int(v * a)))
    return im


def put(F, im, x, y, anchor='mm', alpha=1.0, scale=1.0):
    """Composite im onto frame F; anchor: m=middle, l/r = left/right, t/b = top/bottom."""
    if alpha <= 0.003 or scale <= 0.01:
        return
    if abs(scale - 1) > 0.005:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BILINEAR)
    im = with_alpha(im, alpha)
    ax, ay = anchor[0], anchor[1]
    x0 = x - im.width // 2 if ax == 'm' else (x - im.width if ax == 'r' else x)
    y0 = y - im.height // 2 if ay == 'm' else (y - im.height if ay == 'b' else y)
    x0, y0 = int(x0), int(y0)
    # crop to frame (alpha_composite refuses negative destinations)
    cx0, cy0 = max(0, -x0), max(0, -y0)
    cx1, cy1 = min(im.width, W - x0), min(im.height, H - y0)
    if cx1 <= cx0 or cy1 <= cy0:
        return
    if (cx0, cy0, cx1, cy1) != (0, 0, im.width, im.height):
        im = im.crop((cx0, cy0, cx1, cy1))
    F.alpha_composite(im, (x0 + cx0, y0 + cy0))


def text(F, s, x, y, size, color=WHITE, anchor='mm', alpha=1.0, scale=1.0, weight=700, family='Cairo', rtl=True):
    if size < 4 or alpha <= 0.003:
        return
    put(F, text_img(s, size, color, weight, family, rtl), x, y, anchor, alpha, scale)


@lru_cache(None)
def glow(r, color):
    """Soft round light."""
    s = r * 2
    y, x = np.mgrid[0:s, 0:s]
    d = np.sqrt((x - r + .5) ** 2 + (y - r + .5) ** 2) / r
    a = np.clip(1 - d, 0, 1) ** 2.2
    arr = np.zeros((s, s, 4), np.uint8)
    arr[..., :3] = color
    arr[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


@lru_cache(None)
def _sphere_base(color, R=96):
    s = 2 * R
    y, x = np.mgrid[0:s, 0:s].astype(np.float32)
    nx, ny = (x - R + .5) / R, (y - R + .5) / R
    rr = nx * nx + ny * ny
    inside = rr <= 1
    nz = np.sqrt(np.clip(1 - rr, 0, 1))
    L = np.array([-0.45, -0.55, 0.70]); L /= np.linalg.norm(L)
    diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    spec = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1) ** 28
    c = np.array(color, np.float32)
    rgb = c * (0.28 + 0.78 * diff[..., None]) + 255 * 0.55 * spec[..., None]
    edge = np.clip((1 - np.sqrt(rr)) * R / 1.5, 0, 1)
    arr = np.zeros((s, s, 4), np.uint8)
    arr[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    arr[..., 3] = (inside * edge * 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


@lru_cache(4096)
def sphere(color, r):
    r = max(2, int(r))
    return _sphere_base(color).resize((2 * r, 2 * r), Image.LANCZOS)


ELEM = {  # CPK-like colours and drawing radius
    'H': ((235, 235, 240), 0.55), 'C': ((70, 76, 92), 0.85), 'O': ((235, 60, 60), 0.85),
    'N': ((70, 110, 255), 0.85), 'Na': ((170, 92, 242), 0.75), 'Cl': ((40, 220, 90), 1.05),
    'P': ((255, 140, 0), 0.9), 'A': (TEAL, 0.7), 'T': (PINK, 0.7), 'G': (AMBER, 0.7), 'X': (BLUE, 0.7),
}


def rot(p, ax, ay):
    x, y, z = p
    c, s = math.cos(ay), math.sin(ay)
    x, z = c * x + s * z, -s * x + c * z
    c, s = math.cos(ax), math.sin(ax)
    y, z = c * y - s * z, s * y + c * z
    return x, y, z


def molecule(F, atoms, bonds, cx, cy, scale, ax, ay, alpha=1.0, bond_col=(190, 198, 215), bond_w=None):
    """atoms: [(el, x, y, z)], bonds: [(i, j)] or [(i, j, colour)]. Perspective ball-and-stick."""
    if alpha <= 0.01:
        return
    P = []
    for el, x, y, z in atoms:
        X, Y, Z = rot((x, y, z), ax, ay)
        k = 9 / (9 + Z)
        P.append((cx + X * scale * k, cy + Y * scale * k, Z, k, el))
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0)) if alpha < 1 else None
    tgt = layer if layer is not None else F
    d = ImageDraw.Draw(tgt)
    bw = bond_w or max(3, int(scale * 0.16))
    for b in sorted(bonds, key=lambda b: -(P[b[0]][2] + P[b[1]][2])):
        i, j = b[0], b[1]
        col = b[2] if len(b) > 2 else bond_col
        d.line([(P[i][0], P[i][1]), (P[j][0], P[j][1])], fill=col + (255,), width=bw)
    for x, y, z, k, el in sorted(P, key=lambda p: -p[2]):
        colr, rad = ELEM[el]
        sp = sphere(colr, rad * scale * k * 0.5)
        tgt.alpha_composite(sp, (int(x - sp.width / 2), int(y - sp.height / 2))) if 0 <= x - sp.width / 2 and x + sp.width / 2 < W and 0 <= y - sp.height / 2 and y + sp.height / 2 < H else put(tgt, sp, x, y)
    if layer is not None:
        put(F, layer, 0, 0, 'lt', alpha)


def _ring(n, r, start=90):
    return [(r * math.cos(math.radians(start + 360 * k / n)), -r * math.sin(math.radians(start + 360 * k / n))) for k in range(n)]


def mol_water():
    return [('O', 0, 0, 0), ('H', -0.76, 0.59, 0), ('H', 0.76, 0.59, 0)], [(0, 1), (0, 2)]


def mol_aspirin():
    """Acetylsalicylic acid C9H8O4, flat cartoon coordinates (right connectivity, rough geometry)."""
    A, B = [], []
    ring = _ring(6, 1.4, 90)
    for x, y in ring:
        A.append(('C', x, y, 0))
    for k in range(6):
        B.append((k, (k + 1) % 6))

    def out(i, dist, ang_off=0):
        x, y = A[i][1], A[i][2]
        a = math.atan2(y, x) + math.radians(ang_off)
        return x + dist * math.cos(a), y + dist * math.sin(a)

    def add(el, xy, to):
        A.append((el, xy[0], xy[1], 0)); B.append((to, len(A) - 1)); return len(A) - 1
    c7 = add('C', out(0, 1.5), 0)                      # carboxyl carbon
    x7, y7 = A[c7][1], A[c7][2]
    a0 = math.atan2(y7, x7)
    o8 = add('O', (x7 + 1.25 * math.cos(a0 + 1.0), y7 + 1.25 * math.sin(a0 + 1.0)), c7)
    o9 = add('O', (x7 + 1.3 * math.cos(a0 - 1.0), y7 + 1.3 * math.sin(a0 - 1.0)), c7)
    add('H', (A[o9][1] + 0.95 * math.cos(a0 - 0.2), A[o9][2] + 0.95 * math.sin(a0 - 0.2)), o9)
    o10 = add('O', out(1, 1.4), 1)                     # ester oxygen
    x, y = A[o10][1], A[o10][2]; a1 = math.atan2(y, x)
    c11 = add('C', (x + 1.35 * math.cos(a1 - 0.9), y + 1.35 * math.sin(a1 - 0.9)), o10)
    x, y = A[c11][1], A[c11][2]
    add('O', (x + 1.2 * math.cos(a1 - 2.0), y + 1.2 * math.sin(a1 - 2.0)), c11)
    c13 = add('C', (x + 1.5 * math.cos(a1 + 0.2), y + 1.5 * math.sin(a1 + 0.2)), c11)
    x, y = A[c13][1], A[c13][2]
    for k, off in enumerate((-1.2, 0.0, 1.2)):
        A.append(('H', x + 0.9 * math.cos(a1 + 0.2 + off), y + 0.9 * math.sin(a1 + 0.2 + off), 0.45 * (k - 1)))
        B.append((c13, len(A) - 1))
    for i in (2, 3, 4, 5):
        add('H', out(i, 1.0), i)
    cx = sum(a[1] for a in A) / len(A); cy = sum(a[2] for a in A) / len(A)
    return [(e, x - cx, y - cy, z) for e, x, y, z in A], B


def mol_nacl(n=3):
    A, idx = [], {}
    for i in range(n):
        for j in range(n):
            for k in range(n):
                idx[i, j, k] = len(A)
                A.append(('Na' if (i + j + k) % 2 == 0 else 'Cl', (i - (n - 1) / 2) * 1.6, (j - (n - 1) / 2) * 1.6, (k - (n - 1) / 2) * 1.6))
    B = []
    for (i, j, k), a in idx.items():
        for di, dj, dk in ((1, 0, 0), (0, 1, 0), (0, 0, 1)):
            b = idx.get((i + di, j + dj, k + dk))
            if b is not None:
                B.append((a, b))
    return A, B


def mol_dna(n=14):
    A, B = [], []
    pairs = [('A', 'T'), ('G', 'X'), ('T', 'A'), ('X', 'G')]
    rnd = random.Random(3)
    for i in range(n):
        a = i * 0.62
        y = (i - n / 2) * 0.55
        p, q = rnd.choice(pairs)
        A.append(('P', 1.6 * math.cos(a), y, 1.6 * math.sin(a)))
        A.append(('P', 1.6 * math.cos(a + math.pi * 0.8), y, 1.6 * math.sin(a + math.pi * 0.8)))
        A.append((p, 0.6 * math.cos(a), y, 0.6 * math.sin(a)))
        A.append((q, 0.6 * math.cos(a + math.pi * 0.8), y, 0.6 * math.sin(a + math.pi * 0.8)))
        b = 4 * i
        B += [(b, b + 2), (b + 2, b + 3, (200, 205, 225)), (b + 3, b + 1)]
        if i:
            B += [(b - 4, b, (120, 140, 190)), (b - 3, b + 1, (120, 140, 190))]
    return A, B


def flask(F, cx, cy, s, liquid, level, t, bubbles=0, alpha=1.0, seed=0):
    """Erlenmeyer flask, bottom centre at (cx, cy), height ~ 3.2*s px."""
    L = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(L)
    neck_w, body_w, h, neck_h = 0.42 * s, 2.2 * s, 3.2 * s, 1.1 * s
    top = cy - h
    poly = [(cx - neck_w / 2, top), (cx + neck_w / 2, top), (cx + neck_w / 2, top + neck_h),
            (cx + body_w / 2, cy - 0.12 * s), (cx + body_w / 2 - 0.12 * s, cy), (cx - body_w / 2 + 0.12 * s, cy),
            (cx - body_w / 2, cy - 0.12 * s), (cx - neck_w / 2, top + neck_h)]
    # liquid: clip polygon below the level line
    ly = cy - level * (h - neck_h)
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    lm = Image.new('L', (W, H), 0)
    wav = [(x, ly + 4 * math.sin(x * 0.03 + t * 5)) for x in range(int(cx - body_w), int(cx + body_w), 12)]
    ImageDraw.Draw(lm).polygon(wav + [(cx + body_w, cy + 5), (cx - body_w, cy + 5)], fill=230)
    lm = Image.fromarray(np.minimum(np.asarray(mask), np.asarray(lm)))
    liq = Image.new('RGBA', (W, H), liquid + (0,))
    liq.putalpha(lm)
    L.alpha_composite(liq)
    if bubbles:
        rnd = random.Random(seed)
        for k in range(bubbles):
            ph = (t * (0.5 + rnd.random()) + rnd.random()) % 1
            bx = cx + (rnd.random() - .5) * body_w * 0.7 * (1 - ph * 0.6)
            by = cy - 8 - ph * (cy - ly - 8)
            r = 3 + rnd.random() * 0.08 * s
            if by > ly:
                d.ellipse([bx - r, by - r, bx + r, by + r], outline=(255, 255, 255, 170), width=2)
    d.line(poly + [poly[0]], fill=(220, 235, 255, 230), width=max(3, int(s * 0.06)), joint='curve')
    d.line([(cx - neck_w / 2 - 0.08 * s, top), (cx + neck_w / 2 + 0.08 * s, top)], fill=(220, 235, 255, 255), width=max(4, int(s * 0.09)))
    # highlight on glass
    d.line([(cx - body_w * 0.30, cy - 0.3 * s), (cx - neck_w * 0.2, top + neck_h + 0.2 * s)], fill=(255, 255, 255, 70), width=max(3, int(s * 0.08)))
    put(F, L, 0, 0, 'lt', alpha)


def flame(F, cx, cy, s, t, alpha=1.0):
    for k, (col, sc) in enumerate((((255, 120, 30), 1.0), ((255, 190, 60), 0.7), ((120, 180, 255), 0.4))):
        fl = 1 + 0.12 * math.sin(t * 23 + k * 2) + 0.07 * math.sin(t * 37 + k)
        g = glow(int(s * sc * 0.55 * fl) + 2, col)
        g = g.resize((g.width, int(g.height * 1.7)))
        put(F, g, cx, cy - g.height * 0.38, 'mm', alpha * (0.9 - k * 0.2))


def rounded(F, box, r, fill, outline=None, width=2, alpha=1.0):
    L = Image.new('RGBA', (int(box[2] - box[0]) + 4, int(box[3] - box[1]) + 4), (0, 0, 0, 0))
    ImageDraw.Draw(L).rounded_rectangle([1, 1, box[2] - box[0] + 1, box[3] - box[1] + 1], int(r), fill=fill, outline=outline, width=int(width))
    put(F, L, box[0] - 1, box[1] - 1, 'lt', alpha)


SYMS = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr '
        'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu '
        'Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr '
        'Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split()
assert len(SYMS) == 118


def pt_pos(z):
    """(column 0..17, row 0..8) in the usual 18-column table; f-block in rows 7 and 8."""
    if z == 1: return 0, 0
    if z == 2: return 17, 0
    for start, row in ((3, 1), (11, 2)):
        if start <= z < start + 8:
            i = z - start
            return (i, row) if i < 2 else (i + 10, row)
    if 19 <= z <= 36: return z - 19, 3
    if 37 <= z <= 54: return z - 37, 4
    for base, row, frow in ((55, 5, 7), (87, 6, 8)):
        if z in (base, base + 1): return z - base, row
        if base + 2 <= z <= base + 16: return z - base - 2 + 2, frow   # La..Lu / Ac..Lr
        if base + 17 <= z <= base + 31: return z - base - 17 + 3, row
    raise ValueError(z)


CATCOL = {'alk': (255, 120, 120), 'ae': (255, 180, 110), 'tm': (110, 170, 255), 'pm': (150, 200, 255), 'met': (120, 220, 200),
          'nm': (120, 230, 140), 'hal': (230, 230, 110), 'ng': (200, 140, 255), 'f': (255, 150, 210)}


def pt_cat(z):
    if z in (1, 6, 7, 8, 15, 16, 34): return 'nm'
    if z in (9, 17, 35, 53, 85, 117): return 'hal'
    if z in (2, 10, 18, 36, 54, 86, 118): return 'ng'
    if z in (3, 11, 19, 37, 55, 87): return 'alk'
    if z in (4, 12, 20, 38, 56, 88): return 'ae'
    if z in (5, 14, 32, 33, 51, 52, 84): return 'met'
    if 57 <= z <= 71 or 89 <= z <= 103: return 'f'
    if z in (13, 31, 49, 50, 81, 82, 83, 113, 114, 115, 116): return 'pm'
    return 'tm'


def periodic(F, x0, y0, cell, t, n=118, alpha=1.0, highlight=(), mono=False):
    """Cells appear in a wave (t: 0..1); returns nothing."""
    for z in range(1, n + 1):
        c, r = pt_pos(z)
        k = clamp01(t * 1.6 - (c + r * 1.5) / 40)
        if k <= 0:
            continue
        y = y0 + r * cell * 1.08 + (0.35 * cell if r >= 7 else 0)
        x = x0 + c * cell * 1.08
        col = (200, 200, 200) if mono else CATCOL[pt_cat(z)]
        hl = SYMS[z - 1] in highlight
        a = alpha * ease(k) * (1 if hl or not highlight else 0.35)
        rounded(F, (x, y + (1 - ease(k)) * 20, x + cell, y + cell + (1 - ease(k)) * 20), cell // 7,
                fill=col + (60 if not hl else 200,), outline=col + (255,), width=2, alpha=a)
        text(F, SYMS[z - 1], x + cell / 2, y + cell / 2 + (1 - ease(k)) * 20, int(cell * 0.42), WHITE, alpha=a, rtl=False, family='Cairo')


def arrow(F, x1, y1, x2, y2, col=GREY, w=8, alpha=1.0):
    """Drawn arrow from (x1, y1) to (x2, y2) (fonts here have no arrow glyphs)."""
    L = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    a = math.atan2(y2 - y1, x2 - x1); hl = w * 3.2
    bx, by = x2 - hl * math.cos(a), y2 - hl * math.sin(a)
    d.line([(x1, y1), (bx, by)], fill=col + (255,), width=w)
    d.polygon([(x2, y2), (bx + hl * 0.6 * math.sin(a), by - hl * 0.6 * math.cos(a)), (bx - hl * 0.6 * math.sin(a), by + hl * 0.6 * math.cos(a))], fill=col + (255,))
    put(F, L, 0, 0, 'lt', alpha)
