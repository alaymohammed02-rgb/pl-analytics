"""Round-trip check: transcribe each narration WAV with offline Whisper and compare with the script (word recall)."""
import json, sys, os, re, soundfile as sf, sherpa_onnx
w, voice = sys.argv[1], sys.argv[2]
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f'{w}/small-encoder.int8.onnx', decoder=f'{w}/small-decoder.int8.onnx',
                                                 tokens=f'{w}/small-tokens.txt', language='ar', task='transcribe', num_threads=8)
def norm(t):
    t = re.sub(r'[ً-ْٰـ]', '', t)          # tashkeel, tatweel
    t = re.sub('[إأآٱ]', 'ا', t).replace('ة', 'ه').replace('ى', 'ي')
    return re.findall(r'[ء-ي]+', t)
here = os.path.dirname(os.path.abspath(__file__)); tot = hit = 0
for s in json.load(open(f'{here}/script.json', encoding='utf-8')):
    x, sr = sf.read(f"{voice}/{s['id']}.wav", dtype='float32')
    # whisper takes <=30 s per pass
    words = []
    for i in range(0, len(x), 28 * sr):
        st = rec.create_stream(); st.accept_waveform(sr, x[i:i + 28 * sr]); rec.decode_stream(st); words += norm(st.result.text)
    ref = norm(s['text']); bag = list(words); h = 0
    for r in ref:
        if r in bag: bag.remove(r); h += 1
    tot += len(ref); hit += h
    print(f"{s['id']} recall {h}/{len(ref)} = {h/len(ref):.0%} | {' '.join(words)[:160]}")
print(f"overall word recall {hit/tot:.1%}")
