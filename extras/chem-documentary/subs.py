"""Subtitles from the narration timing: short lines (at most MAXW words), burned into the video and written as SRT."""
import re
from arabic import DISPLAY

MAXW, MINW = 7, 3


def apply_display(t):
    for a, b in DISPLAY.items():
        t = t.replace(a, b)
    return t


def letters(s):
    return len(re.findall('[ء-ي0-9]', s))


def chunk_lines(ck):
    """Lines (start, end, text) of one synthesis chunk, times in seconds from the start of the scene's voice.
    Words are timed by their share of the chunk's letters; a line breaks at punctuation once it has MINW words,
    and never exceeds MAXW words."""
    toks = []
    for part in ck['parts']:
        for w in apply_display(part['show']).split():
            toks.append(w)
    total = sum(letters(w) + 1 for w in toks) or 1
    dur = ck['end'] - ck['start']
    t, spans = ck['start'], []
    for w in toks:
        d = dur * (letters(w) + 1) / total
        spans.append((t, t + d, w)); t += d
    lines, cur = [], []
    for k, (a, b, w) in enumerate(spans):
        cur.append((a, b, w))
        end_mark = bool(re.search('[،.:؛؟!]$', w))
        rest = len(spans) - k - 1
        if len(cur) >= MAXW or (end_mark and len(cur) >= MINW) or rest == 0:
            lines.append(cur); cur = []
    # an orphan of one or two words at the end joins the previous line if it still fits in MAXW + 1
    if len(lines) > 1 and len(lines[-1]) <= 2 and len(lines[-2]) + len(lines[-1]) <= MAXW + 1:
        tail = lines.pop()
        lines[-1] = lines[-1] + tail
    return [(l[0][0], l[-1][1], ' '.join(x[2] for x in l)) for l in lines]


def scene_lines(chunks):
    out = []
    for ck in chunks:
        out += chunk_lines(ck)
    # a line stays until the next one starts when the gap is short (no flicker), else it ends a little after its words
    fixed = []
    for k, (a, b, t) in enumerate(out):
        nxt = out[k + 1][0] if k + 1 < len(out) else None
        e = b + 0.12 if nxt is None or nxt - b > 0.5 else nxt
        fixed.append((round(a, 3), round(e, 3), t))
    return fixed


def srt_time(x):
    ms = int(round(x * 1000))
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


def write_srt(path, scenes):
    """scenes: [(scene_start, lead, [(a, b, text), ...])] -> SRT file; an RLM keeps Arabic punctuation in place."""
    n, rows = 1, []
    for st, lead, lines in scenes:
        for a, b, t in lines:
            rows.append(f'{n}\n{srt_time(st + lead + a)} --> {srt_time(st + lead + b)}\n‏{t}‏\n')
            n += 1
    open(path, 'w', encoding='utf-8').write('\n'.join(rows))
