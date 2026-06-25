# Framework Detection Signatures

Detect first, then search only relevant patterns. Never shotgun-search all patterns.

## Phase 0: Header Detection (curl)

```bash
curl -sI https://target.com | grep -iE "x-powered-by|server|cf-ray|x-vercel|x-amz"
```

| Header | Framework/Platform |
|--------|-------------------|
| `X-Powered-By: Next.js` | Next.js |
| `X-Powered-By: Express` | Node/Express |
| `Server: nginx` + no other signals | Static/custom |
| `CF-Ray:` | Behind Cloudflare |
| `X-Vercel-*` | Vercel-hosted |
| `x-shopify-*` | Shopify |

## HTML Signature Detection

```bash
curl -s https://target.com | grep -oE '__NEXT_DATA__|window\.__NUXT__|wp-content|Shopify\.|_rails'
```

| HTML Pattern | Framework | Best Data Source |
|-------------|-----------|-----------------|
| `<script id="__NEXT_DATA__"` | Next.js | `__NEXT_DATA__` JSON |
| `window.__NUXT__` | Nuxt.js | Inline JSON |
| `/wp-content/` | WordPress | REST API `/wp-json/wp/v2/` |
| `Shopify.shop` | Shopify | `/products.json`, `/collections.json` |
| `data-reactroot` | React (generic) | Traffic interception for API |
| `ng-version` | Angular | Traffic interception |
| `__svelte` | Svelte | Usually static, Cheerio works |

## Known Sites (bypass generic detection)

| Domain Pattern | Skip Detection, Use Directly |
|---------------|------------------------------|
| `amazon.com` | Product API + structured DOM |
| `linkedin.com` | High-protection — needs full recon |
| `twitter.com` | Official API or traffic interception |
| `instagram.com` | Traffic interception (GraphQL) |

## Post-Detection Strategy

After identifying framework:
- **Next.js** → check `__NEXT_DATA__` first (often has full page data), then `/_next/data/` API routes
- **Nuxt** → check `window.__NUXT__` inline JSON
- **WordPress** → use `/wp-json/wp/v2/posts?per_page=100` REST API
- **Shopify** → `/products.json`, `/collections/all/products.json`
- **React SPA** → traffic interception to find API
- **Static HTML** → Cheerio directly
