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
    """Waqf (pausal form) before every pause: a clause-final word loses its case vowel / nunation.
    Read with the vowel, the voice sounds it ("al-kimiya'u", "nawatihi"); a fluent MSA reader stops on a sukun.
      -u -i -a  ->  sukun        -un -in  ->  sukun        -an (with alif)  ->  -a + alif        ta marbuta -> ha
    """
    D = '\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652'          # tanween x3, fatha, damma, kasra, shadda, sukun
    pause = r'(?=[\u00BB"\u201D]*\s*(?:[\u060C.:\u061B\u061F!]|$))'

    def fix(m):
        w = m.group(0)
        w = re.sub('\u064B\u0627$', '\u064E\u0627', w)                 # -an + alif  -> -a + alif (long a in waqf)
        w = re.sub('\u0629\u064B$', '\u0647\u0652', w)                 # ta marbuta + -an -> ha
        w = re.sub('\u0629[\u064C\u064D\u064E\u064F\u0650]?$', '\u0647\u0652', w)   # ta marbuta (+ vowel) -> ha
        w = re.sub('\u064B$', '', w)                                    # bare -an (on hamza / ta) -> nothing
        w = re.sub('[\u064B\u064C\u064D\u064E\u064F\u0650]\u0651$', '\u0651', w)   # vowel + shadda (-iyyu, -mmun) -> shadda
        w = re.sub('\u0651[\u064B\u064C\u064D\u064E\u064F\u0650]$', '\u0651', w)   # shadda + vowel -> shadda
        w = re.sub('\u0651\u0652$', '\u0651', w)                      # shadda + sukun -> shadda
        w = re.sub('[\u064C\u064D\u064E\u064F\u0650]$', '\u0652', w)  # -un -in -a -u -i  -> sukun
        return w
    return re.sub('[\u0621-\u064A' + D + ']+' + pause, fix, text)


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
