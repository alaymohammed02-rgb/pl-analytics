"""Downloads the real black-and-white archive photographs for scene 2 from Wikimedia Commons.

Run on a machine with internet access (the build sandbox could not reach Wikimedia):
    python3 fetch_archive.py
Only files whose Commons licence is public domain, CC0 or CC BY(-SA) are kept; each one's author, date and licence go into
archive/archive.json and are printed on screen under the photo. With no files, scene 2 shows labelled illustrations.
"""
import json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'archive')
API = 'https://commons.wikimedia.org/w/api.php'
UA = {'User-Agent': 'chem-documentary/1.0 (educational video build script)'}

# slot: (caption on screen, exact Commons titles to try first, search text if none of them is usable)
# archive_* = scene 2 (black-and-white archive); portrait_* = scene 7 (the scientists' cards)
SLOTS = [
    ('archive_curie', 'بيير وماري كوري في مختبرهما', ['File:Pierre and Marie Curie.jpg', 'File:Pierre Curie and Marie Sklodowska Curie, 1903.jpg'],
     'Pierre Marie Curie laboratory photograph'),
    ('archive_mendeleev', 'جدول مندلييف الدوري الأصلي (1869)', ["File:Mendeleev's 1869 periodic table.png", 'File:Mendelejevs periodiska system 1871.png'],
     'Mendeleev 1869 periodic table'),
    ('archive_solvay', 'مؤتمر سولفاي 1927 — بروكسل', ['File:Solvay conference 1927.jpg'], 'Solvay conference 1927'),
    ('portrait_razi', 'الرازي في مخطوطة لاتينية (نحو 1250م)', ['File:Al-RaziInGerardusCremonensis1250.JPG'], 'Rhazes Gerard of Cremona manuscript'),
    ('portrait_lavoisier', 'لافوازييه', ['File:Antoine lavoisier.jpg', 'File:Antoine-Laurent Lavoisier.jpg'], 'Antoine Lavoisier portrait'),
    ('portrait_mendeleev', 'مندلييف', ['File:Dmitri Mendeleev 1890s.jpg', 'File:Dmitri Mendeleev.jpg'], 'Dmitri Mendeleev portrait photograph'),
    ('portrait_curie', 'ماري كوري', ['File:Marie Curie c1920.jpg', 'File:Marie Curie 1903.jpg', 'File:Mariecurie.jpg'], 'Marie Curie portrait photograph'),
]


def fetch(url, tries=6):
    # Wikimedia answers 429 to fast callers: pace every request and back off
    for k in range(tries):
        time.sleep(1.5)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or k == tries - 1:
                raise
            time.sleep(5 * 2 ** k)


def get(params):
    return json.loads(fetch(f"{API}?{urllib.parse.urlencode(dict(params, format='json'))}"))


def info(title):
    r = get(dict(action='query', titles=title, prop='imageinfo', iiprop='url|extmetadata', iiurlwidth=1800))
    for p in r['query']['pages'].values():
        if 'imageinfo' in p:
            ii = p['imageinfo'][0]
            md = {k: re.sub('<[^>]+>', '', str(v.get('value', ''))).strip() for k, v in ii.get('extmetadata', {}).items()}
            return dict(title=p['title'], url=ii.get('thumburl') or ii['url'], page=ii.get('descriptionurl', ''),
                        license=md.get('LicenseShortName', ''), artist=md.get('Artist', ''), date=md.get('DateTimeOriginal', ''))
    return None


def free(i):
    # public domain / CC0, or CC BY(-SA) whose credit is printed under the picture
    return bool(i) and re.search(r'public domain|^pd|cc0|^cc by', i['license'], re.I)


def search(text):
    r = get(dict(action='query', list='search', srsearch=text, srnamespace=6, srlimit=10))
    return [h['title'] for h in r['query']['search']]


PER_SLOT = 3   # keep a few candidates per slot; the first one is used unless archive.json is reordered


def main():
    os.makedirs(OUT, exist_ok=True)
    items = []
    for slot, cap, titles, q in SLOTS:
        try:
            found = search(q)
        except Exception as e:
            print('   search error', e); found = []
        got, seen = 0, set()
        for t in titles + found:
            if got >= PER_SLOT or t in seen or not re.search(r'\.(jpe?g|png|tiff?)$', t, re.I):
                continue
            seen.add(t)
            try:
                i = info(t)
            except Exception as e:
                print('  ', t, 'error', e); continue
            print(f"  {t}: {i and i['license']}")
            if not free(i):
                continue
            ext = os.path.splitext(urllib.parse.urlparse(i['url']).path)[1] or '.jpg'
            fn = f'{slot}_{got + 1}{ext}'
            try:
                open(os.path.join(OUT, fn), 'wb').write(fetch(i['url']))
            except Exception as e:
                print('   download error', e); continue
            artist = (i['artist'][:60] or 'مجهول').replace('\n', ' ')
            items.append(dict(slot=slot, file=fn, caption=cap, title=i['title'], source=i['page'], license=i['license'],
                              credit=f"{i['title'][5:]} — {artist} — {i['license']} — Wikimedia Commons"))
            got += 1
        print(f'{slot}: {got} file(s)')
    json.dump(items, open(os.path.join(OUT, 'archive.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(items)} photos saved in {OUT}')
    return 0 if items else 1


if __name__ == '__main__':
    sys.exit(main())
