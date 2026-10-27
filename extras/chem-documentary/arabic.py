"""Arabic text helpers for the narration: pausal reading (waqf), clause splitting, display text for subtitles."""
import re

TANWEEN = 'ًٌٍ'                 # -an -un -in
SHORT = 'َُِ'                    # fatha damma kasra
SHADDA, SUKUN = 'ّ', 'ْ'
DIAC = TANWEEN + SHORT + SHADDA + SUKUN
LETTER = 'ء-ي'
WORD = re.compile('[' + LETTER + DIAC + ']+')
PUNCT = '،.:؛؟!'                 # ، . : ؛ ؟ !

# Words whose last short vowel is part of the word, not a case ending: kept as written.
KEEP = {'هُوَ', 'هِيَ'}  # هُوَ هِيَ  (already read fine; listed for clarity)


def waqf(w):
    """One word in pausal form: it loses its case vowel / nunation (the way a fluent reader stops on a sukun).
    -u -i -a, -un -in -> sukun;  -an + alif -> -a + alif;  ta marbuta -> ha;  vowel + shadda -> shadda."""
    w = re.sub('ًا$', 'َا', w)                 # -an + alif  -> long a
    w = re.sub('ةً$', 'هْ', w)                 # ta marbuta + -an -> ha
    w = re.sub('ة[' + TANWEEN[1:] + SHORT + ']?$', 'هْ', w)   # ta marbuta (+ vowel) -> ha
    w = re.sub('ً$', '', w)                                    # bare -an -> nothing
    w = re.sub('[' + TANWEEN + SHORT + ']ّ$', SHADDA, w)       # -iyyu, -mmun -> shadda
    w = re.sub(SHADDA + '[' + TANWEEN + SHORT + ']$', SHADDA, w)    # shadda + vowel -> shadda
    w = re.sub(SHADDA + SUKUN + '$', SHADDA, w)
    w = re.sub('[' + TANWEEN[1:] + SHORT + ']$', SUKUN, w)          # -un -in -u -i -a -> sukun
    return w


def tasqeen(text):
    """Pausal reading for every word (the usual documentary style: no case endings, all inner vowels kept)."""
    return WORD.sub(lambda m: m.group(0) if m.group(0) in KEEP else waqf(m.group(0)), text)


def clauses(text):
    """Split at ، . : ؛ ؟ ! keeping the mark: [(clause_text_without_mark, mark)]."""
    out = []
    for m in re.finditer('([^' + PUNCT + ']+)([' + PUNCT + ']?)', text):
        c = m.group(1).strip()
        if c:
            out.append((c, m.group(2)))
    return out


DISPLAY = {'مندليف': 'مندلييف'}   # voice spelling -> the usual written spelling


def plain(text):
    """Display form for subtitles and the script: no diacritics, and the usual spelling of names the voice spells its own way."""
    t = re.sub('[ً-ْٰـ]', '', text)
    for a, b in DISPLAY.items():
        t = t.replace(a, b)
    return t
