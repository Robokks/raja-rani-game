# Cheerio vs Browser Decision

## Quick Rule

- **Cheerio (HTTP-only)** → all target data found in raw HTML
- **Browser (Playwright)** → data rendered by JS after page load
- **API** → traffic revealed a JSON endpoint (always prefer this)

## Phase 0: Raw HTML Check

```bash
curl -s -L "https://target.com/page" | grep -i "target data"
```

| Result | Action |
|--------|--------|
| All data points found | Use Cheerio — skip browser |
| 50–99% found | Browser only for missing points |
| <50% found | Launch browser |

## Three-Way Comparison (when browser needed)

| Data Point | Raw HTML | Rendered DOM | API | Best Source |
|-----------|----------|-------------|-----|------------|
| Title | YES | YES | YES | Raw HTML (simplest) |
| Price | NO | YES | NO | Rendered DOM |
| Reviews | NO | NO | YES | API |

## Validation — REQUIRED before claiming "found"

Finding text in HTML is NOT enough. Test the actual extraction path:

**CSS Selector validation:**
```js
// Must confirm: selector exists, matches 1 element, returns correct value
document.querySelector('#productTitle')?.innerText // === expected value?
```

**JSON path validation:**
```js
// Confirm path resolves to expected value
data.props.pageProps.product.title // === expected value?
```

**API endpoint validation:**
```bash
# Replay request outside browser — confirm response contains expected data
curl -H "Cookie: session=..." "https://api.target.com/products/123"
```

## Common Pitfalls

- **Minified class names** (`.css-1a2b3c`) change between builds — use `data-*` attributes instead
- **Partial SSR** — price shows as `$--` in HTML, `$29.99` after hydration — always compare raw vs rendered
- **Script tag data** — JSON inside `<script>` is not a DOM element — parse with regex/JSON.parse, not CSS selector
- **Split elements** — text split across `<span>` tags — use `.textContent` of parent, not child selector
