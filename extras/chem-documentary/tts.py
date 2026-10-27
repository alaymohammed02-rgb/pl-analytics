"""Narration: one WAV per scene, built clause by clause, with the offline Piper Arabic voice (sherpa-onnx).

  python3 tts.py MODEL_DIR OUT_DIR [--speed 1.15] [--noise 0.5] [--noise-w 0.0] [--irab]

* Each clause (text between ، . : ؛ ؟ !) is synthesised on its own, trimmed, and joined with a fixed pause, so the
  start and end of every clause are known exactly: timing.json drives the subtitles and the on-screen cues.
* Reading style: full case endings inside a clause, pausal form (no final vowel) on the last word before every pause;
  --no-irab drops all case endings. Measured with Whisper turbo on this script: 5.6% character error rate against 7.8%.
* noise_w = 0 makes the duration predictor deterministic: the stochastic one sometimes squeezes a word.
"""
import argparse, json, os, re
import numpy as np, soundfile as sf, sherpa_onnx
from arabic import clauses, tasqeen, waqf, plain, WORD

HERE = os.path.dirname(os.path.abspath(__file__))
PAUSE = {'': 0.08, '،': 0.12, ':': 0.20, '؛': 0.20, '.': 0.30, '؟': 0.30, '!': 0.30}   # seconds after the clause
LATIN = {'،': ',', '؛': ';', '؟': '?', '.': '.', ':': ':', '!': '!', '': ''}


def make(model, noise, noise_w, threads=4):
    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
        vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=f'{model}/ar_JO-kareem-medium.onnx', tokens=f'{model}/tokens.txt',
                                                   data_dir=f'{model}/espeak-ng-data', noise_scale=noise, noise_scale_w=noise_w),
        num_threads=threads)))


def spoken(clause, mark, irab=False):
    """What the voice is given: vowelled clause in pausal form (or i'rab form with only the last word in waqf)."""
    t = re.sub('[«»"]', '', clause)
    if irab:
        words = list(WORD.finditer(t))
        if words:
            m = words[-1]; t = t[:m.start()] + waqf(m.group(0)) + t[m.end():]
    else:
        t = tasqeen(t)
    return t + LATIN[mark]


def trim(x, sr, thr=0.01, pad=0.03):
    nz = np.flatnonzero(np.abs(x) > thr)
    return x[max(nz[0] - int(pad * sr), 0): nz[-1] + 1 + int(pad * sr)] if len(nz) else x


def chunks(text, min_letters):
    """Group clauses into synthesis chunks: a one-word list item or a tiny clause sounds clipped when voiced alone,
    so clauses are joined (punctuation kept inside) until a chunk has min_letters letters or a sentence ends."""
    out, cur = [], []
    for c, mark in clauses(text):
        cur.append((c, mark))
        n = len(re.findall('[\u0621-\u064A]', ''.join(x for x, _ in cur)))
        if (n >= min_letters or mark in '.؟!') and mark != ':' or (mark == ':' and n >= min_letters):
            out.append(cur); cur = []
    if cur:
        out.append(cur)
    return out


def synth_scene(tts, text, speed, irab=False, min_letters=28):
    sr, parts, info, t = tts.sample_rate, [], [], 0.0
    cks = chunks(text, min_letters)
    for k, ck in enumerate(cks):
        say = ' '.join(spoken(c, m, irab) for c, m in ck)
        a = tts.generate(say, sid=0, speed=speed)
        x = trim(np.asarray(a.samples, dtype=np.float32), sr)
        raw = ' '.join(c + m for c, m in ck)
        info.append(dict(text=raw, show=plain(raw), say=say, parts=[dict(show=plain(c) + m, mark=m) for c, m in ck],
                         start=round(t, 3), end=round(t + len(x) / sr, 3)))
        parts.append(x)
        gap = 0.0 if k == len(cks) - 1 else PAUSE[ck[-1][1]]
        parts.append(np.zeros(int(gap * sr), np.float32))
        t += len(x) / sr + gap
    return np.concatenate(parts), sr, info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('model'); ap.add_argument('out')
    ap.add_argument('--speed', type=float, default=1.25)
    ap.add_argument('--noise', type=float, default=0.667)
    ap.add_argument('--noise-w', type=float, default=0.0)
    ap.add_argument('--irab', action=argparse.BooleanOptionalAction, default=True, help='keep case endings inside a clause; only the last word of each clause is read in pausal form')
    ap.add_argument('--merge', type=int, default=45, help='min letters per synthesis chunk')
    ap.add_argument('--script', default=os.path.join(HERE, 'script.json'))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    tts = make(a.model, a.noise, a.noise_w)
    timing, total = [], 0.0
    for s in json.load(open(a.script, encoding='utf-8')):
        x, sr, info = synth_scene(tts, s['text'], a.speed, a.irab, a.merge)
        sf.write(f"{a.out}/{s['id']}.wav", x, sr, subtype='PCM_16')
        timing.append(dict(id=s['id'], dur=round(len(x) / sr, 3), clauses=info))
        total += len(x) / sr
        print(f"{s['id']} {len(x) / sr:6.2f}s  {len(info)} chunks")
    json.dump(timing, open(f'{a.out}/timing.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'total {total:.2f}s  (speed {a.speed}, noise {a.noise}, noise_w {a.noise_w}, {"i`rab" if a.irab else "pausal"})')


if __name__ == '__main__':
    main()
