#!/usr/bin/env python3
"""Fetch the latest items for each topic into data.json (+ thumbnails in img/).

Topics are RSS or JSON feeds. We fetch them ourselves (not via the frame's
cloud proxy), so any source with a feed works. Article images are pulled from
RSS media tags or the page's og:image, lightly posterized to suit the pixel look.
"""
import json, os, re, html, urllib.request, xml.etree.ElementTree as ET
from io import BytesIO
from PIL import Image, ImageOps

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"}
WX_LAT, WX_LON = 44.98, -93.27   # Twin Cities; change to taste

def get(url, t=9):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=t).read()

def getj(url):
    return json.loads(get(url))

def rss_items(url, n):
    root = ET.fromstring(get(url))
    out = []
    for it in root.findall('.//item')[:n]:
        title = html.unescape(re.sub('<[^>]+>', '', it.findtext('title') or '')).strip()
        link = it.findtext('link') or ''
        img = None
        for tag in ('{http://search.yahoo.com/mrss/}content',
                    '{http://search.yahoo.com/mrss/}thumbnail', 'enclosure'):
            e = it.find(tag)
            if e is not None and e.get('url'):
                img = e.get('url'); break
        out.append({'t': title, 'link': link, 'img': img})
    return out

def og_image(url):
    try:
        h = get(url, 8).decode('utf-8', 'ignore')
        for pat in (r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)',
                    r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)'):
            m = re.search(pat, h, re.I)
            if m:
                return html.unescape(m.group(1))
    except Exception:
        pass
    return None

def grab_image(src, name):
    try:
        im = Image.open(BytesIO(get(src, 10))).convert('RGB')
        im = ImageOps.fit(im, (320, 200), Image.LANCZOS)
        im = ImageOps.posterize(im, 5)
        os.makedirs('img', exist_ok=True)
        p = f'img/{name}.jpg'; im.save(p, 'JPEG', quality=82); return p
    except Exception:
        return None

def main():
    d = {}
    # --- Security ---
    for k, u in (('krebs', 'https://krebsonsecurity.com/feed/'),
                 ('bleeping', 'https://www.bleepingcomputer.com/feed/'),
                 ('thn', 'https://feeds.feedburner.com/TheHackersNews')):
        try: d[k] = rss_items(u, 4)
        except Exception: d[k] = []
    # --- Make / tech ---
    try: d['hackaday'] = rss_items('https://hackaday.com/feed/', 4)
    except Exception: d['hackaday'] = []
    # --- AI / LLM ---
    hf = getj('https://huggingface.co/api/models?sort=trendingScore&limit=5')
    d['hf'] = [{'t': m['id'], 'link': 'https://huggingface.co/' + m['id'], 'img': None} for m in hf][:4]
    hn = getj('https://hn.algolia.com/api/v1/search?query=LLM&tags=story&numericFilters=points%3E100')
    d['hn_llm'] = [{'t': h['title'], 'p': h['points'], 'c': h.get('num_comments', 0),
                    'link': h.get('url') or f"https://news.ycombinator.com/item?id={h['objectID']}",
                    'img': None} for h in hn['hits'][:3]]
    # --- crypto + weather ---
    d['btc'] = getj('https://api.coinbase.com/v2/prices/BTC-USD/spot')['data']['amount']
    d['eth'] = getj('https://api.coinbase.com/v2/prices/ETH-USD/spot')['data']['amount']
    wx = getj('https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s'
              '&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,'
              'temperature_2m_min&temperature_unit=fahrenheit&timezone=America/Chicago'
              '&forecast_days=4' % (WX_LAT, WX_LON))
    d['wx_now'] = round(wx['current']['temperature_2m'])
    d['wx_code'] = wx['current']['weather_code']
    d['wx_daily'] = [{'hi': round(a), 'lo': round(b), 'c': c} for a, b, c in
                     zip(wx['daily']['temperature_2m_max'], wx['daily']['temperature_2m_min'],
                         wx['daily']['weather_code'])]
    # --- resolve thumbnails (skip HF/HN: their og images are just text cards) ---
    for key in ('bleeping', 'thn', 'hackaday'):
        for i, it in enumerate(d.get(key, [])):
            src = it.get('img') or (og_image(it['link']) if it.get('link') else None)
            it['img'] = grab_image(src, f'{key}_{i}') if src else None
    json.dump(d, open('data.json', 'w'), indent=1)
    print('wrote data.json')

if __name__ == '__main__':
    main()
