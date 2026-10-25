import json, datetime, html as H
d = json.load(open('data.json'))
def esc(s): return H.escape(str(s))
def clip(s,n):
    s=str(s); return s if len(s)<=n else s[:n-1].rstrip()+'…'

now=datetime.datetime.now()
try: clock=now.strftime('%-I:%M')
except: clock=now.strftime('%H:%M')
dowk=now.strftime('%a').upper(); mon=now.strftime('%b').upper(); dnum=str(int(now.strftime('%d')))
daystr=dowk+' · '+mon+' '+dnum

WMO={0:('☀','clear'),1:('☀','mostly clear'),2:('☁','partly cloudy'),3:('☁','overcast'),
 45:('≈','fog'),48:('≈','fog'),51:('☂','drizzle'),53:('☂','drizzle'),55:('☂','drizzle'),
 61:('☂','rain'),63:('☂','rain'),65:('☂','rain'),71:('❄','snow'),73:('❄','snow'),75:('❄','snow'),
 80:('☂','showers'),81:('☂','showers'),82:('☂','showers'),95:('⚡','storm')}
def wx(c): return WMO.get(c,('☁','—'))
now_ic,now_wd=wx(d.get('wx_code',3)); daily=d.get('wx_daily',[])
fc=''
for i,lbl in zip([1,2,3],['SUN','MON','TUE']):
    if i<len(daily):
        ic,_=wx(daily[i]['c']); fc+='<div>'+lbl+'<br>'+ic+'︎<b>'+str(daily[i]['lo'])+'–'+str(daily[i]['hi'])+'</b></div>'

def hero(cls,tag,title,det,img,glyph='★'):
    if img:
        inner='style="background-image:url('+img+')"><span class="tag">'+esc(tag)+'</span>'
    else:
        inner='><span class="tag">'+esc(tag)+'</span><span class="emblem">'+glyph+'</span>'
    cls=cls+('' if img else ' noimg')
    return ('<div class="hero '+cls+'"><div class="banner" '+inner+'</div>'
            '<div class="cap2"><div class="ttl">'+esc(clip(title,70))+'</div><div class="det">'+esc(det)+'</div></div></div>')
def row(cls,glyph,label,title,det,img):
    left=('<div class="thumb" style="background-image:url('+img+')"></div>') if img else ('<div class="stamp '+cls+'">'+glyph+'</div>')
    return ('<div class="row">'+left+'<div class="bd"><div class="lbl '+cls+'">'+esc(label)+'</div>'
            '<div class="ttl2">'+esc(clip(title,72))+'</div><div class="det2">'+esc(det)+'</div></div></div>')

hf=d.get('hf',[]); hl=d.get('hn_llm',[]); kr=d.get('krebs',[]); bl=d.get('bleeping',[]); th=d.get('thn',[]); hd=d.get('hackaday',[])
def g(lst,i): return lst[i] if i<len(lst) else None

# PAGE 1 AI & LLM  (HF/HN have no good images -> emblem hero + glyph rows)
p1=''
if g(hf,0): p1+=hero('o','New Model · trending', hf[0]['t'], 'Hugging Face · top of the trending list', None, '◈')
p1+='<div class="rows">'
if g(hl,0): p1+=row('t','■','Hacker News · '+str(hl[0]['p'])+' ▲', hl[0]['t'], str(hl[0]['c'])+' comments', None)
if g(hl,1): p1+=row('m','◆','Hacker News · '+str(hl[1]['p'])+' ▲', hl[1]['t'], str(hl[1]['c'])+' comments', None)
if g(hf,1): p1+=row('g','✦','New Model · trending', hf[1]['t'], 'Hugging Face', None)
p1+='</div>'
# PAGE 2 SECURITY
p2=''
if g(bl,0): p2+=hero('t','BleepingComputer · new', bl[0]['t'], 'bleepingcomputer.com', bl[0].get('img'))
p2+='<div class="rows">'
if g(kr,0): p2+=row('o','⚠','Krebs on Security', kr[0]['t'], 'krebsonsecurity.com', kr[0].get('img'))
if g(th,0): p2+=row('m','◆','The Hacker News', th[0]['t'], 'thehackernews.com', th[0].get('img'))
if g(bl,1): p2+=row('b','■','BleepingComputer', bl[1]['t'], 'bleepingcomputer.com', bl[1].get('img'))
p2+='</div>'
# PAGE 3 MAKE / TECH
p3=''
if g(hd,0): p3+=hero('d','Hackaday · DIY & tech', hd[0]['t'], 'hackaday.com', hd[0].get('img'))
p3+='<div class="rows">'
gl=['▲','◆','★']; cl=['g','b','o']
for i in (1,2,3):
    if g(hd,i): p3+=row(cl[i-1],gl[i-1],'Hackaday · DIY & tech', hd[i]['t'], 'hackaday.com', hd[i].get('img'))
p3+='</div>'

pages=[('AI & LLM',p1),('SECURITY',p2),('MAKE · TECH',p3)]
track=''.join('<div class="pg">'+pages[i][1]+'</div>' for i in [0,1,2,0])
labels_js=json.dumps([pages[i][0] for i in [0,1,2]])
btc=('${:,.0f}'.format(float(d['btc']))) if d.get('btc') not in (None,'?') else '$-'
eth=('${:,.0f}'.format(float(d['eth']))) if d.get('eth') not in (None,'?') else '$-'

tpl=open('src/template.html').read()
for k,v in {'%%WXCHIP%%':now_ic+'︎ '+str(d.get('wx_now','?'))+'&deg;F','%%DOW%%':dowk,'%%MONDAY%%':mon+' '+dnum,
 '%%TRACK%%':track,'%%CLOCK%%':clock,'%%DAYSTR%%':daystr,'%%NOWWX%%':now_ic+'︎ '+str(d.get('wx_now','?'))+'&deg;F · '+now_wd,
 '%%FC%%':fc,'%%BTC%%':btc,'%%ETH%%':eth,'%%LABELS%%':labels_js}.items(): tpl=tpl.replace(k,v)
open('journal.html','w').write(tpl)
print('built with heroes+images')
