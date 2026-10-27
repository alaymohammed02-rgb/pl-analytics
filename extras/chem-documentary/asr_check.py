"""Round-trip check of the narration: transcribe every clause WAV with offline Whisper and score it against the script.

  python3 asr_check.py WHISPER_DIR build/voice [--worst 15]

WHISPER_DIR holds a sherpa-onnx Whisper export (turbo-* or small-* files). Needs build/voice/timing.json from tts.py.
The score is the character error rate (CER) of the unvocalised text; Whisper is not a perfect judge (foreign names
are often spelled differently), so read the worst clauses, don't chase 0.
"""
import json, os, re, sys, glob
import numpy as np, soundfile as sf, sherpa_onnx


def load(w):
    pre = 'turbo' if glob.glob(f'{w}/turbo-encoder*') else 'small'
    suf = '.int8.onnx' if glob.glob(f'{w}/{pre}-encoder.int8.onnx') else '.onnx'
    return sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f'{w}/{pre}-encoder{suf}', decoder=f'{w}/{pre}-decoder{suf}',
                                                      tokens=f'{w}/{pre}-tokens.txt', language='ar', task='transcribe', num_threads=4)


def norm(t):
    t = re.sub(r'[ً-ْٰـ]', '', t)
    t = re.sub('[إأآٱ]', 'ا', t).replace('ة', 'ه').replace('ى', 'ي').replace('ؤ', 'و').replace('ئ', 'ي')
    return ' '.join(re.findall(r'[ء-ي0-9]+', t))


def cer(ref, hyp):
    a, b = ref.replace(' ', ''), hyp.replace(' ', '')
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (ca != cb))
    return d[-1] / max(1, len(a))


if __name__ == '__main__':
    w, voice = sys.argv[1], sys.argv[2]
    worst = int(sys.argv[sys.argv.index('--worst') + 1]) if '--worst' in sys.argv else 12
    rec = load(w)
    timing = json.load(open(f'{voice}/timing.json', encoding='utf-8'))
    rows = []
    for sc in timing:
        x, sr = sf.read(f"{voice}/{sc['id']}.wav", dtype='float32')
        for c in sc['clauses']:
            seg = np.concatenate([np.zeros(int(0.4 * sr), np.float32), x[int(c['start'] * sr):int(c['end'] * sr)], np.zeros(int(0.6 * sr), np.float32)])
            st = rec.create_stream(); st.accept_waveform(sr, seg); rec.decode_stream(st)
            hyp, ref = norm(st.result.text), norm(c['show'])
            if re.search('[0-9]', hyp):   # Whisper writes years as digits: not comparable with the spelled-out words
                continue
            rows.append((cer(ref, hyp), sc['id'], ref, hyp))
    tot = sum(len(r[2].replace(' ', '')) for r in rows)
    print(f"clauses {len(rows)}  mean CER {np.mean([r[0] for r in rows]):.3f}  weighted CER {sum(r[0] * len(r[2].replace(' ', '')) for r in rows) / tot:.3f}")
    for c, sid, ref, hyp in sorted(rows, reverse=True)[:worst]:
        print(f'{c:.2f} {sid} | {ref} | {hyp}')
