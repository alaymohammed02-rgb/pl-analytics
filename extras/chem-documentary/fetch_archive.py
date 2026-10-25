"""Downloads the real black-and-white archive photographs for scene 2 from Wikimedia Commons.

Run on a machine with internet access (the build sandbox could not reach Wikimedia):
    python3 fetch_archive.py
Only files whose Commons licence is public domain, CC0 or CC BY(-SA) are kept; each one's author, date and licence go into
archive/archive.json and are printed on screen under the photo. With no files, scene 2 shows labelled illustrations.
"""
import json, os, re, sys, urllib.parse, urllib.request

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


def get(params):
    q = urllib.parse.urlencode(dict(params, format='json'))
    with urllib.request.urlopen(urllib.request.Request(f'{API}?{q}', headers=UA), timeout=30) as r:
        return json.load(r)


def info(title):
    r = get(dict(action='query', titles=title, prop='imageinfo', iiprop='url|extmetadata', iiurlwidth=1800))
    for p in r['query']['pages'].values():
        if 'imageinfo' in p:
            ii = p['imageinfo'][0]
            md = {k: re.sub('<[^>]+>', '', v.get('value', '')).strip() for k, v in ii.get('extmetadata', {}).items()}
            return dict(title=p['title'], url=ii.get('thumburl') or ii['url'], page=ii.get('descriptionurl', ''),
                        license=md.get('LicenseShortName', ''), artist=md.get('Artist', ''), date=md.get('DateTimeOriginal', ''))
    return None


def free(i):
    # public domain / CC0, or CC BY(-SA) whose credit is printed under the picture
    return bool(i) and re.search(r'public domain|^pd|cc0|^cc by', i['license'], re.I)


def search(text):
    r = get(dict(action='query', list='search', srsearch=text, srnamespace=6, srlimit=10))
    return [h['title'] for h in r['query']['search']]


def main():
    os.makedirs(OUT, exist_ok=True)
    items = []
    for slot, cap, titles, q in SLOTS:
        chosen = None
        try:
            found = search(q)
        except Exception as e:
            print('   search error', e); found = []
        for t in titles + found:
            try:
                i = info(t)
            except Exception as e:
                print('  ', t, 'error', e); continue
            print(f"  {t}: {i and i['license']}")
            if free(i):
                chosen = i; break
        if not chosen:
            print(f'{slot}: no public-domain file found, scene 2 keeps the illustration'); continue
        ext = os.path.splitext(urllib.parse.urlparse(chosen['url']).path)[1] or '.jpg'
        fn = f'{slot}{ext}'
        with urllib.request.urlopen(urllib.request.Request(chosen['url'], headers=UA), timeout=60) as r:
            open(os.path.join(OUT, fn), 'wb').write(r.read())
        artist = chosen['artist'][:60] or 'مجهول'
        items.append(dict(slot=slot, file=fn, caption=cap, credit=f"{chosen['title'][5:]} — {artist} — {chosen['license']} — Wikimedia Commons",
                          source=chosen['page']))
        print(f'{slot}: {chosen["title"]} ({chosen["license"]})')
    json.dump(items, open(os.path.join(OUT, 'archive.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(items)} photos saved in {OUT}')
    return 0 if items else 1


if __name__ == '__main__':
    sys.exit(main())
