# Sitemap-Based URL Discovery

60× faster URL discovery, 100× less bandwidth vs link crawling.
Use for: large sites (100+ pages), e-commerce catalogs, blogs, news sites.

## When to Use

- Site has 100+ pages to scrape
- Need complete coverage of all URLs
- E-commerce (products), blog (posts), news (articles)

## When to Skip

- Single-page apps (no sitemap)
- Dynamic/user-generated content (sitemap outdated)
- Single target URL

## Step 1: Check robots.txt First

```bash
curl -s https://target.com/robots.txt | grep -i sitemap
```

robots.txt lists all sitemap URLs. Always check here first.

## Step 2: Common Sitemap Locations

```
/sitemap.xml
/sitemap_index.xml
/sitemap-products.xml
/sitemap-posts.xml
/news-sitemap.xml
```

## Step 3: Parse with Crawlee (recommended)

```js
import { RobotsFile } from 'crawlee';

// Auto-finds robots.txt and parses ALL sitemaps including nested + gzipped
const robots = await RobotsFile.find('https://target.com');
const urls = await robots.getSitemapUrls();
```

## Step 4: Filter to Target Content

```js
// Products only
const productUrls = urls.filter(url => /\/products\//.test(url));

// Posts only
const postUrls = urls.filter(url => /\/blog\/|\/posts\//.test(url));

// Recent only (check lastmod)
const recentUrls = sitemapEntries
  .filter(entry => new Date(entry.lastmod) > cutoffDate)
  .map(entry => entry.loc);
```

## Step 5: Hybrid — Sitemap + API

Best of both worlds:
1. Sitemap gives all URLs (fast, complete)
2. API gives structured data per URL (clean JSON)

```js
const urls = await getSitemapUrls('https://shop.com');
const products = await Promise.all(
  urls.map(url => fetch(`${url}.json`).then(r => r.json()))
);
```

## Error Handling

```js
try {
  const sitemap = await fetchSitemap('/sitemap.xml');
} catch (e) {
  // Fallback to link crawling
  await crawler.addRequests([{ url: 'https://target.com' }]);
}
```
