// Fetches live news for each topic from its RSS feeds, merges, sorts by newest,
// and returns a compact list per topic for the broadcast. Robust by design:
// a dead or slow feed is skipped, never fatal.
import Parser from 'rss-parser';
import { TOPICS } from './sources.mjs';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'TimesFrameBroadcast/1.0 (+github.com/Intranet-Explorer)' },
  customFields: { item: [
    ['media:content', 'mediaContent', { keepArray: true }],
    ['media:thumbnail', 'mediaThumb'],
    ['content:encoded', 'contentEncoded'],
  ] },
});

function hostOf(url){ try{ return new URL(url).hostname.replace(/^www\./,''); }catch{ return ''; } }
function rel(date){
  if(!date) return '';
  const s = Math.max(0, (Date.now()-new Date(date).getTime())/1000);
  if(s<3600) return Math.round(s/60)+'m';
  if(s<86400) return Math.round(s/3600)+'h';
  return Math.round(s/86400)+'d';
}
function imageOf(item){
  const mc = item.mediaContent;
  if(Array.isArray(mc)){
    const img = mc.find(m=>m?.$?.medium==='image' || (m?.$?.type||'').startsWith('image')) || mc[0];
    if(img?.$?.url) return img.$.url;
  }
  if(item.mediaThumb?.$?.url) return item.mediaThumb.$.url;
  if(item.enclosure?.url && (item.enclosure.type||'').startsWith('image')) return item.enclosure.url;
  const html = item.contentEncoded || item.content || '';
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  if(m) return m[1];
  return null;
}
function clean(t){ return (t||'').replace(/\s+/g,' ').trim(); }

async function feed(url){
  try{ const f = await parser.parseURL(url);
    const src = clean(f.title) || hostOf(url);
    return (f.items||[]).map(it=>({
      title: clean(it.title), link: it.link,
      source: src, host: hostOf(it.link||url),
      date: it.isoDate || it.pubDate || null, image: imageOf(it),
    }));
  }catch(e){ console.warn('feed failed:', url, e.message); return []; }
}

export async function getNews(){
  const out = [];
  for(const topic of TOPICS){
    const lists = await Promise.all(topic.feeds.map(feed));
    let items = lists.flat().filter(x=>x.title);
    // dedupe by normalized title
    const seen = new Set();
    items = items.filter(x=>{ const k=x.title.toLowerCase().slice(0,60); if(seen.has(k))return false; seen.add(k); return true; });
    items.sort((a,b)=> new Date(b.date||0) - new Date(a.date||0));
    const stories = items.slice(0, topic.max).map(x=>({
      title: x.title, source: (x.source||x.host||'').toUpperCase(),
      time: rel(x.date), image: x.image,
    }));
    out.push({ key: topic.key, label: topic.label, accent: topic.accent, stories });
  }
  return out;
}

// top headlines across all topics, for the ticker
export function tickerFrom(news){
  const heads = [];
  for(const t of news){ if(t.stories[0]) heads.push(t.stories[0].title); }
  return heads;
}

if(import.meta.url===`file://${process.argv[1]}`){
  getNews().then(n=>console.log(JSON.stringify(n,null,2))).catch(e=>{console.error(e);process.exit(1)});
}
