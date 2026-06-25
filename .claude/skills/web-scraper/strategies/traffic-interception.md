# Traffic Interception Strategy

Best for: Single-page apps, sites with internal APIs, auth flow discovery.
Advantage: 10–100× faster than DOM scraping — raw JSON vs parsing HTML.

## When to Use

- Site uses React/Vue/Angular (likely has internal API)
- DOM scraping is fragile (class names change)
- Need to understand auth flow
- Phase 0 curl shows blank/minimal HTML

## When to Skip

- Already know the API from prior recon
- Pure static HTML (Cheerio is faster)
- No JS rendering needed

## Workflow

### 1. Launch
```js
// MITM proxy + stealth Chrome captures all network activity
interceptor_chrome_launch(url, { stealthMode: true, devtools: true, mitm: true })
```

### 2. Analyze Page Load Traffic
```js
proxy_list_traffic({ url_filter: '/api/' })
proxy_search_traffic({ query: 'application/json' })
// Look for: /api/, /v1/, /graphql, /_next/data/, /_nuxt/
```

### 3. Interact to Trigger More Endpoints
```js
// Paginate, filter, search — watch new API calls appear
humanizer_click('[data-page="2"]')
humanizer_scroll({ direction: 'down', amount: 500 })
// Check traffic after each interaction
```

### 4. Validate Discovered Endpoints
```bash
# Replay outside browser — confirm data is accessible
curl -H "Authorization: Bearer <token>" "https://api.target.com/v1/products?page=1"
```

## Common Endpoint Patterns

| Pattern | Type |
|---------|------|
| `/api/v1/products` | REST paginated |
| `/_next/data/[hash]/page.json` | Next.js SSR data |
| `/graphql` POST | GraphQL |
| `/wp-json/wp/v2/posts` | WordPress REST |
| `/collections/all/products.json` | Shopify |

## Auth Token Extraction

```js
// Cookies from browser session
const cookies = await interceptor_chrome_devtools_get_cookies()

// Bearer token from localStorage
const token = await interceptor_chrome_devtools_evaluate('localStorage.getItem("token")')
```

## Clear Traffic Before Each Action

```js
proxy_clear_traffic()  // isolate API calls from page-load noise
humanizer_click('[data-action="load-more"]')
proxy_list_traffic({ url_filter: 'api' })  // only see calls from this action
```
