import { XMLParser } from 'fast-xml-parser';

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  source: FeedSource;
}

export interface FeedSource {
  name: string;
  url: string;
  color: string;
  category: string;
}

export const SOURCES: FeedSource[] = [
  { name: 'Anthropic',      url: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml', color: '#d4896a', category: 'labs' },
  { name: 'OpenAI',         url: 'https://openai.com/news/rss.xml',                                color: '#74b894', category: 'labs' },
  { name: 'Google DeepMind',url: 'https://deepmind.google/blog/rss.xml',                           color: '#7ab3e0', category: 'labs' },
  { name: 'Hugging Face',   url: 'https://huggingface.co/blog/feed.xml',                           color: '#f0c040', category: 'tools' },
  { name: 'Mistral',        url: 'https://raw.githubusercontent.com/0xSMW/rss-feeds/main/feeds/feed_mistral_news.xml', color: '#b07ae0', category: 'labs' },
  { name: 'The Verge AI',   url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', color: '#e07a7a', category: 'media' },
  { name: 'Ars Technica',   url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',       color: '#e09a5a', category: 'media' },
  { name: 'MIT Tech Review',url: 'https://www.technologyreview.com/feed/',                         color: '#6ab0c0', category: 'media' },
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function extractItems(parsed: any, source: FeedSource): FeedItem[] {
  // RSS 2.0
  const rssItems = parsed?.rss?.channel?.item;
  // Atom
  const atomEntries = parsed?.feed?.entry;

  const raw = rssItems ?? atomEntries;
  if (!raw) return [];

  const arr: any[] = Array.isArray(raw) ? raw : [raw];

  return arr.slice(0, 15).map((item): FeedItem | null => {
    const title = item.title?.['#text'] ?? item.title ?? '';
    const link =
      item.link?.['@_href'] ??
      (typeof item.link === 'string' ? item.link : '') ??
      item.guid?.['#text'] ?? item.guid ?? '';
    const description = stripHtml(item.description ?? item.summary?.['#text'] ?? item.summary ?? item.content?.['#text'] ?? '');
    const rawDate = item.pubDate ?? item.published ?? item.updated ?? '';
    const pubDate = rawDate ? new Date(rawDate) : new Date(0);

    if (!title || !link) return null;
    return { title, link, description: description.slice(0, 200), pubDate, source };
  }).filter((i): i is FeedItem => i !== null);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

export async function fetchAllFeeds(): Promise<{ items: FeedItem[]; errors: string[] }> {
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'ai-news-dashboard/1.0 (RSS reader)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const parsed = parser.parse(xml);
      return extractItems(parsed, source);
    })
  );

  const items: FeedItem[] = [];
  const errors: string[] = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    } else {
      errors.push(`${SOURCES[i].name}: ${result.reason?.message ?? 'failed'}`);
    }
  });

  items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  return { items, errors };
}
