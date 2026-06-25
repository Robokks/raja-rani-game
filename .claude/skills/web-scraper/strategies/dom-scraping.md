# DOM Scraping via DevTools

Use ONLY when: traffic interception found no clean API AND JS rendering is required.

## Decision

| Condition | Use DOM Scraping? |
|-----------|-----------------|
| API discovered in traffic | NO — use API (10× faster) |
| Static HTML sufficient | NO — use Cheerio (5× faster) |
| JS-rendered, no API | YES |
| Interactions needed (click/form) | YES |

## Preferred: Accessibility Tree (not CSS selectors)

Accessibility tree survives CSS/class changes. CSS selectors break when styles change.

```js
// Preferred — semantic, stable
const snapshot = await interceptor_chrome_devtools_snapshot()
// Parse by role: button, heading, listitem, link

// Fallback — CSS selector
const el = await interceptor_chrome_devtools_query_selector('#product-title')
```

## Interaction with Humanizer (anti-detection)

```js
// Mouse follows Bezier curves, typing uses WPM timing, idle has micro-jitter
await humanizer_click('[data-action="load-more"]')
await humanizer_type('#search', 'query term')
await humanizer_scroll({ direction: 'down', pixels: 800 })
await humanizer_idle({ minMs: 800, maxMs: 2000 })
```

## Extract Auth Tokens During Session

```js
// After logging in via browser, extract session for API calls
const cookies = await interceptor_chrome_devtools_get_cookies()
const token = await interceptor_chrome_devtools_evaluate(
  'document.cookie || localStorage.getItem("token")'
)
```

## Clear Traffic Before Each Interaction

```js
proxy_clear_traffic()           // isolate this action's API calls
await humanizer_click('.next-page')
const calls = proxy_list_traffic({ url_filter: 'api' })  // only new calls
```

## Screenshot for Debugging

```js
await interceptor_chrome_devtools_screenshot('debug-state.png')
```

## Production: Convert to Crawlee

```js
// Dev: interceptor_chrome_*
// Production: PlaywrightCrawler

import { PlaywrightCrawler } from 'crawlee';

const crawler = new PlaywrightCrawler({
  async requestHandler({ page }) {
    await page.waitForSelector('.product-list');
    const items = await page.$$eval('.product-item', els =>
      els.map(el => ({
        title: el.querySelector('h2')?.textContent,
        price: el.querySelector('.price')?.textContent,
      }))
    );
    await Actor.pushData(items);
  },
});
```
