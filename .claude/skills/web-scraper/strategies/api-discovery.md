# API Discovery and Usage

APIs deliver 10–100× faster scraping with greater reliability than HTML parsing.
Always check for APIs before attempting DOM scraping.

## Discovery via Traffic Capture

```js
// Launch stealth browser + proxy
interceptor_chrome_launch(url, { stealthMode: true, mitm: true })

// Filter captured traffic
proxy_list_traffic({ url_filter: 'api' })
proxy_search_traffic({ query: 'application/json' })
```

## Common API Patterns to Look For

| Pattern | Type |
|---------|------|
| `/api/v1/`, `/api/v2/` | REST versioned |
| `/_next/data/[hash]/` | Next.js page data |
| `/_nuxt/` | Nuxt page data |
| `/graphql` | GraphQL (POST) |
| `/wp-json/wp/v2/` | WordPress REST |
| `/products.json` | Shopify |
| `?format=json`, `?output=json` | Hidden JSON mode |

## REST API Implementation

```js
import got from 'got-scraping'; // preferred over fetch — browser headers, retries, proxy support

const response = await got(`https://api.target.com/v1/products`, {
  searchParams: { page: 1, limit: 50 },
  headers: { Authorization: `Bearer ${token}` },
});
const data = JSON.parse(response.body);
```

## GraphQL API

```js
const response = await got.post('https://target.com/graphql', {
  json: {
    query: `query { products(first: 50) { edges { node { title price } } } }`,
  },
  headers: { 'Content-Type': 'application/json' },
});
```

## Pagination Patterns

```js
// Offset-based
for (let page = 1; ; page++) {
  const data = await fetchPage(page);
  if (!data.items.length) break;
  results.push(...data.items);
}

// Cursor-based
let cursor = null;
do {
  const data = await fetchPage(cursor);
  results.push(...data.items);
  cursor = data.nextCursor;
} while (cursor);
```

## Auth Token Extraction

```js
// From cookies
const cookies = await interceptor_chrome_devtools_get_cookies();
const sessionCookie = cookies.find(c => c.name === 'session');

// From localStorage
const token = await interceptor_chrome_devtools_evaluate(
  'localStorage.getItem("authToken")'
);

// From captured request headers
const authHeader = traffic.find(req => req.headers['Authorization'])
  ?.headers['Authorization'];
```

## Rate Limiting

```js
import { sleep } from 'crawlee';

for (const item of items) {
  await processItem(item);
  await sleep(500 + Math.random() * 500); // 0.5–1s between requests
}
```
