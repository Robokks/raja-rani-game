# Anti-Patterns to Avoid

## 1. Crawling When a Sitemap Exists

```js
// BAD
await crawler.addRequests([startUrl]); // slow link-by-link crawl

// GOOD
const urls = await RobotsFile.find('https://target.com').getSitemapUrls();
await crawler.addRequests(urls); // 60× faster
```

## 2. Scraping DOM When API Is Available

```js
// BAD — fragile HTML parsing when traffic showed an API
const price = await page.$eval('.price-value', el => el.textContent);

// GOOD — use the API directly
const data = await got('https://api.target.com/products/123').json();
const price = data.price;
```

## 3. Arbitrary Sleep Instead of Humanizer

```js
// BAD — static sleep is a bot signal
await sleep(2000);

// GOOD — natural idle with micro-movements
await humanizer_idle({ minMs: 800, maxMs: 2500 });
```

## 4. Manual Project Setup Instead of apify create

```bash
# BAD — manually creating folders, package.json, tsconfig
mkdir my-actor && npm init

# GOOD — correct structure, linting, TypeScript, templates
apify create my-actor
```

## 5. TLS Spoofing with Chrome Browser

```js
// BAD — Chrome already has a valid TLS fingerprint; spoofing breaks it
interceptor_chrome_launch(url, { stealthMode: true });
proxy_set_fingerprint_spoof({ preset: "chrome_latest" }); // DON'T combine these

// GOOD — TLS spoof is ONLY for HTTP-only clients
proxy_set_fingerprint_spoof({ preset: "chrome_latest" });
const data = await gotScraping(url); // HTTP client, not browser
```

## 6. Wrong Chrome Navigation Method

```js
// BAD — loses DevTools session attachment
await interceptor_chrome_navigate(url);

// GOOD — maintains DevTools session
await interceptor_chrome_devtools_navigate(url);
```

## 7. Skipping Stealth Mode on Protected Sites

```js
// BAD — gets detected immediately
interceptor_chrome_launch(url, { stealthMode: false });

// GOOD — always use stealth on unknown sites
interceptor_chrome_launch(url, { stealthMode: true });
```

## 8. No Error Handling on DOM Queries

```js
// BAD — crashes if element missing
const title = document.querySelector('.title').textContent;

// GOOD — graceful null handling
const title = document.querySelector('.title')?.textContent ?? null;
```

## 9. Not Clearing Traffic Logs Before Actions

```js
// BAD — can't tell which API call belongs to which action
humanizer_click('.load-more');
proxy_list_traffic(); // cluttered with all previous calls

// GOOD — isolate exactly what this action triggers
proxy_clear_traffic();
await humanizer_click('.load-more');
proxy_list_traffic({ url_filter: 'api' }); // only new calls
```

## 10. Claiming "Found" Without Validating

```js
// BAD — text appears in HTML but selector doesn't work
// "Found: price text in HTML" ← not enough

// GOOD — test the actual extraction path
const price = document.querySelector('span[data-price]')?.getAttribute('data-price');
console.assert(price === '29.99', 'selector validation failed');
```
