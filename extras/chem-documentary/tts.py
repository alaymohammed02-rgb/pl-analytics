"""Narration: one WAV per scene from script.json with the offline Piper Arabic voice (sherpa-onnx)."""
import json, sys, os, numpy as np, soundfile as sf, sherpa_onnx
model, out, speed = sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
os.makedirs(out, exist_ok=True)
cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
    vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=f'{model}/ar_JO-kareem-medium.onnx',
        tokens=f'{model}/tokens.txt', data_dir=f'{model}/espeak-ng-data'), num_threads=4), silence_scale=float(os.environ.get('SIL', '0.2')))
tts = sherpa_onnx.OfflineTts(cfg)
here = os.path.dirname(os.path.abspath(__file__))
total = 0
import re


def pausal(text):
    # MSA pause form: a word-final taa marbuta before a pause is read "h", not "t" (the voice said "al-udwiyyat")
    return re.sub(r'ة[\u064B-\u0652]*(?=\s*[،.:؛؟!»]|$)', 'ه', text)


for s in json.load(open(f'{here}/script.json', encoding='utf-8')):
    a = tts.generate(pausal(s['text']), sid=0, speed=speed)
    x = np.asarray(a.samples, dtype=np.float32)
    # trim leading/trailing silence so scenes stay tight
    nz = np.flatnonzero(np.abs(x) > 0.01)
    x = x[max(nz[0] - 800, 0): nz[-1] + 1600]
    sf.write(f"{out}/{s['id']}.wav", x, a.sample_rate, subtype='PCM_16')
    d = len(x) / a.sample_rate; total += d
    print(f"{s['id']} {d:6.2f}s")
print(f"total {total:.2f}s")
