// News sources for the Times Frame broadcast, one entry per topic page.
// Add or remove RSS/Atom feed URLs freely; the fetcher merges a topic's feeds,
// sorts by newest, and shows the top few. Dead feeds are skipped, not fatal.
// `max` = how many stories the topic page shows (1 featured + the rest listed).

export const TOPICS = [
  {
    key: 'AI', label: 'AI News', accent: '#34d2ff', max: 4,
    feeds: [
      'https://techcrunch.com/category/artificial-intelligence/feed/',
      'https://venturebeat.com/category/ai/feed/',
      'https://the-decoder.com/feed/',
    ],
  },
  {
    key: 'INFOSEC', label: 'InfoSec News', accent: '#ff5d6c', max: 4,
    feeds: [
      'https://feeds.feedburner.com/TheHackersNews',
      'https://www.bleepingcomputer.com/feed/',
      'https://krebsonsecurity.com/feed/',
    ],
  },
  {
    key: 'CRYPTO', label: 'Crypto News', accent: '#f7a600', max: 4,
    feeds: [
      'https://www.coindesk.com/arc/outboundfeeds/rss/',
      'https://cointelegraph.com/rss',
    ],
  },
  {
    key: 'MICROSOFT', label: 'Microsoft', accent: '#3fb0ff', max: 4,
    feeds: [
      'https://news.microsoft.com/feed/',
      'https://www.theverge.com/microsoft/rss/index.xml',
    ],
  },
  {
    key: 'ENTRA', label: 'Entra & Intune', accent: '#6d9cff', max: 4,
    feeds: [
      'https://msendpointmgr.com/feed/',
      'https://call4cloud.nl/feed/',
      'https://www.petri.com/feed/',
    ],
  },
  {
    key: 'GENERAL', label: 'General News', accent: '#9aa1ab', max: 4,
    feeds: [
      'https://feeds.npr.org/1001/rss.xml',
      'https://feeds.bbci.co.uk/news/rss.xml',
    ],
  },
];
