"""Builds the documentary: timeline from the narration WAVs, frames (parallel), music + mix, final MP4.

  python3 render.py [--preview SECONDS_LIST] [--out FILE]
Env: DOC_NAME (closing name), ARCHIVE_DIR, FONT_DIR.
"""
import argparse, json, math, os, re, subprocess, sys, wave
from multiprocessing import Pool
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
BUILD = os.path.join(HERE, 'build')
VOICE = os.path.join(BUILD, 'voice')
FPS = 30
LEAD, GAP, HOLD_END = 0.10, 0.22, 1.6     # voice starts LEAD after a cut; GAP after it; end card holds HOLD_END
SR = 44100
EXTRA = {'s02': 1.5}   # let the archive photos breathe (music only, no long silence)


def timeline():
    script = json.load(open(os.path.join(HERE, 'script.json'), encoding='utf-8'))
    from scenes import BEATS
    T, t = [], 0.0
    for i, s in enumerate(script):
        v = sf.info(os.path.join(VOICE, s['id'] + '.wav')).duration
        d = LEAD + v + GAP + (HOLD_END if i == len(script) - 1 else 0) + EXTRA.get(s['id'], 0)
        # beats: share of characters before the phrase (tashkeel counted alike on both sides) -> share of voice time
        txt = s['text']
        beats = {}
        for k, ph in BEATS.get(s['id'], {}).items():
            j = txt.find(ph)
            assert j >= 0, (s['id'], ph)
            beats[k] = LEAD + v * j / len(txt)
        T.append(dict(id=s['id'], start=t, dur=d, voice=v, beats=beats))
        t += d
    return T, t


def frame_at(T, gt):
    import scenes
    from gfx import W, H, put, glow, ease, clamp01
    from PIL import Image
    i = max(j for j, s in enumerate(T) if s['start'] <= gt + 1e-9)
    s = T[i]
    lt = gt - s['start']
    F = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    scenes.SCENES[i](F, lt, s['dur'], s['beats'])
    # fast cut transition: punch-in zoom + light flash at each scene start
    if i > 0 and lt < 0.45:
        k = ease(clamp01(lt / 0.45))
        z = 1.06 - 0.06 * k
        F = F.resize((int(W * z), int(H * z)), Image.BILINEAR).crop((int((W * z - W) / 2), int((H * z - H) / 2), int((W * z - W) / 2) + W, int((H * z - H) / 2) + H))
        flash = Image.new('RGBA', (W, H), (255, 255, 255, int(150 * (1 - clamp01(lt / 0.25)))))
        F.alpha_composite(flash)
    # fade in from black at the very start, out at the very end
    total = T[-1]['start'] + T[-1]['dur']
    a = min(clamp01(gt / 0.35), clamp01((total - gt) / 0.6))
    if a < 1:
        F.alpha_composite(Image.new('RGBA', (W, H), (0, 0, 0, int(255 * (1 - a)))))
    return F.convert('RGB')


def render_chunk(args):
    T, f0, f1, path = args
    from gfx import W, H
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', path], stdin=subprocess.PIPE)
    for f in range(f0, f1):
        p.stdin.write(frame_at(T, f / FPS).tobytes())
    p.stdin.close(); p.wait()
    assert p.returncode == 0
    return path


# ---------- audio ----------

def music(total):
    """Calm generated bed: soft pad chords (Am F C G) + light plucked arpeggio, 96 bpm."""
    n = int(total * SR) + SR
    t = np.arange(n) / SR
    out = np.zeros(n, np.float32)
    chords = [(57, 60, 64), (53, 57, 60), (48, 52, 55), (55, 59, 62)]   # MIDI
    bar = 60 / 96 * 4
    f = lambda m: 440 * 2 ** ((m - 69) / 12)
    for b in range(int(total / bar) + 2):
        ch = chords[b % 4]
        t0 = b * bar
        i0, i1 = int(t0 * SR), min(n, int((t0 + bar * 1.25) * SR))
        if i0 >= n:
            break
        tt = t[i0:i1] - t0
        env = np.minimum(1, tt / 0.8) * np.exp(-np.maximum(0, tt - bar) * 3)
        for m in ch:
            for det in (-0.07, 0.07):
                out[i0:i1] += 0.05 * env * np.sin(2 * np.pi * f(m + det - 12) * tt)
        out[i0:i1] += 0.05 * env * np.sin(2 * np.pi * f(ch[0] - 24) * tt)
        # arpeggio, 8th notes
        for k in range(8):
            ts = t0 + k * bar / 8
            j0 = int(ts * SR); j1 = min(n, j0 + int(0.5 * SR))
            if j0 >= n:
                break
            tk = t[j0:j1] - ts
            m = ch[(0, 1, 2, 1, 0, 2, 1, 2)[k]] + 12
            out[j0:j1] += 0.022 * np.exp(-tk * 7) * np.sin(2 * np.pi * f(m) * tk) * (1 + 0.3 * np.sin(2 * np.pi * f(m) * 2 * tk))
    # gentle low-pass (moving average)
    y = np.convolve(out, np.ones(6) / 6, mode='same')
    return y[:int(total * SR)]


def whoosh(d=0.45, seed=0):
    rng = np.random.RandomState(seed)
    n = int(d * SR)
    x = rng.randn(n).astype(np.float32)
    # crude band-pass sweep by differencing + moving average of varying width
    tt = np.arange(n) / n
    env = np.sin(np.pi * tt) ** 2
    y = np.convolve(x, np.ones(9) / 9, mode='same') - np.convolve(x, np.ones(60) / 60, mode='same')
    return 0.12 * env * y


def mix_audio(T, total, path):
    n = int(total * SR)
    voice = np.zeros(n, np.float32)
    for s in T:
        x, sr = sf.read(os.path.join(VOICE, s['id'] + '.wav'), dtype='float32')
        if sr != SR:
            idx = np.arange(0, len(x) - 1, sr / SR)
            x = np.interp(idx, np.arange(len(x)), x).astype(np.float32)
        i0 = int((s['start'] + LEAD) * SR)
        voice[i0:i0 + len(x)] += x[:n - i0]
    voice *= 0.9 / (np.abs(voice).max() + 1e-9)
    m = music(total)
    # duck the music under speech
    win = int(0.25 * SR)
    lev = np.sqrt(np.convolve(voice ** 2, np.ones(win) / win, mode='same'))
    duck = 1 - 0.55 * np.clip(lev / 0.05, 0, 1)
    m = m * duck * 0.9
    sfx = np.zeros(n, np.float32)
    for k, s in enumerate(T[1:]):
        w = whoosh(seed=k)
        i0 = max(0, int((s['start'] - 0.2) * SR))
        sfx[i0:i0 + len(w)] += w[:n - i0]
    out = voice + m + sfx
    fade = np.minimum(1, np.minimum(np.arange(n) / (0.3 * SR), (n - np.arange(n)) / (1.0 * SR)))
    out *= fade
    st = np.stack([out, out], 1)
    sf.write(path, np.clip(st, -1, 1), SR, subtype='PCM_16')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', help='comma list of seconds: write stills only')
    ap.add_argument('--out', default=os.path.join(BUILD, 'chemistry_documentary.mp4'))
    ap.add_argument('--jobs', type=int, default=os.cpu_count())
    a = ap.parse_args()
    T, total = timeline()
    os.makedirs(BUILD, exist_ok=True)
    json.dump(dict(total=total, scenes=T), open(os.path.join(BUILD, 'timeline.json'), 'w'), indent=1, ensure_ascii=False)
    print(f'total {total:.2f}s')
    if a.preview:
        os.makedirs(os.path.join(BUILD, 'stills'), exist_ok=True)
        for x in a.preview.split(','):
            frame_at(T, float(x)).save(os.path.join(BUILD, 'stills', f'{float(x):07.2f}.jpg'), quality=85)
        return
    nf = int(round(total * FPS))
    chunks = []
    step = math.ceil(nf / (a.jobs * 3))
    for k, f0 in enumerate(range(0, nf, step)):
        chunks.append((T, f0, min(nf, f0 + step), os.path.join(BUILD, f'part_{k:03d}.mp4')))
    with Pool(a.jobs) as p:
        for i, path in enumerate(p.imap(render_chunk, chunks)):
            print(f'chunk {i + 1}/{len(chunks)}', flush=True)
    lst = os.path.join(BUILD, 'parts.txt')
    open(lst, 'w').write(''.join(f"file '{c[3]}'\n" for c in chunks))
    wav = os.path.join(BUILD, 'mix.wav')
    mix_audio(T, nf / FPS, wav)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-i', wav,
                    '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k',
                    '-movflags', '+faststart', '-shortest', a.out], check=True)
    for c in chunks:
        os.remove(c[3])
    print('wrote', a.out)


if __name__ == '__main__':
    main()
