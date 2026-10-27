"""Compare alternative spellings of a word inside its real sentence: synthesise each, transcribe with Whisper, print CER.

  python3 vtest.py MODEL_DIR WHISPER_DIR groups.json     groups.json = [{"label": ..., "sentence": "... {W} ...", "variants": [...]}]
The reference text is the sentence with the first variant's plain spelling; the display form is the same for all variants.
"""
import json, sys, numpy as np, sherpa_onnx
import tts as T
from arabic import plain, clauses
from asr_check import load, norm, cer

model, wdir, groups = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3], encoding='utf-8'))
speed = float(sys.argv[4]) if len(sys.argv) > 4 else 1.25
tts, rec = T.make(model, 0.667, 0.0), load(wdir)
for g in groups:
    ref = norm(plain(g['sentence'].replace('{W}', g['show'])))
    for v in g['variants']:
        x, sr, info = T.synth_scene(tts, g['sentence'].replace('{W}', v), speed, True, 45)
        pad = np.zeros(int(0.5 * sr), np.float32)
        st = rec.create_stream(); st.accept_waveform(sr, np.concatenate([pad, x, pad])); rec.decode_stream(st)
        hyp = norm(st.result.text)
        print(f"{cer(ref, hyp):.2f} | {g['label']} | {v} | {hyp}")
    print()
