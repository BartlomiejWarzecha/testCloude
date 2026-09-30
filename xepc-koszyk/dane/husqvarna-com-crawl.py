import re, json, sys, time, urllib.request, concurrent.futures as cf, html
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
urls = [l.strip() for l in open('do-pobrania.txt') if l.strip()]
done = set()
try:
    for l in open('wyniki.jsonl'): done.add(json.loads(l)['url'])
except FileNotFoundError: pass
urls = [u for u in urls if u not in done]
def parse(url, s):
    path = url.replace('https://www.husqvarna.com', '')
    m = re.search(r'"__typename":"(\w+)","id":"\{[^"]+\}","sku":"(MP_\d+)","url":"' + re.escape(path) + '"', s)
    typ, mp = (m.group(1), m.group(2)) if m else (None, None)
    arts = set(re.findall(r'<option value="(\d{9,10})"', s))
    arts |= set(re.findall(r'"articleNumber":\s*"(\d{9,10})"', s))
    if m:
        seg = s[m.end(): m.end() + 60000]
        cut = min([i for i in (seg.find('"recommendedProducts"'), seg.find('"necessaryProducts"'), seg.find('"productModelAlternatives"')) if i >= 0] or [len(seg)])
        arts |= set(re.findall(r'"articles":\[\{"id":"(\d{9,10})"', seg[:cut]))
        arts |= set(re.findall(r'\{"id":"(\d{9,10})","description"', seg[:cut]))
    name = re.search(r'"productInfo":\s*\{\s*"name":\s*"([^"]*)"', s)
    return {'url': url, 'typ': typ, 'mp': mp, 'arts': sorted(arts), 'nazwa': html.unescape(name.group(1)) if name else None}
def fetch(url):
    for proba in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'pl'})
            with urllib.request.urlopen(req, timeout=40) as r:
                return parse(url, r.read().decode('utf-8', 'ignore'))
        except Exception as e:
            err = str(e); time.sleep(2 * (proba + 1))
    return {'url': url, 'blad': err}
with open('wyniki.jsonl', 'a') as out, cf.ThreadPoolExecutor(4) as ex:
    for i, r in enumerate(ex.map(fetch, urls), 1):
        out.write(json.dumps(r, ensure_ascii=False) + '\n'); out.flush()
        if i % 200 == 0: print(i, '/', len(urls), flush=True)
print('koniec', len(urls))
