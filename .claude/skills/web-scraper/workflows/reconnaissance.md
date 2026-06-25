# Phase 1: Browser Reconnaissance

Only run this phase if Phase 0 (curl) left data points unresolved.

## Setup

Launch stealth Chrome with DevTools + MITM proxy to capture all network activity automatically.

```js
// Stealth mode patches navigator.webdriver and chrome.runtime
interceptor_chrome_launch(url, { stealthMode: true, devtools: true })
```

## Traffic Analysis Steps

1. **Capture page load traffic** — identify REST APIs, GraphQL endpoints, auth headers
2. **Filter for data endpoints**:
   - `/api/`, `/v1/`, `/v2/`, `/_next/data/`, `/graphql`
   - `Content-Type: application/json` responses
3. **Interact with site** — paginate, filter, search — while monitoring new API calls
4. **Check anti-bot signals**: Cloudflare cookies, CAPTCHA triggers, rate limit headers, fingerprint scripts

## Key Questions to Answer

- Is data in raw HTML or JS-rendered?
- Is there a hidden API returning JSON?
- What auth (cookies / bearer token / API key) is needed?
- Is there bot protection? At what level?

## Output → feeds Phase 3 (Validate)

Document every discovered endpoint with:
- URL pattern
- Method (GET/POST)
- Auth requirements
- Sample response structure
- Pagination mechanism

## Early Exit

If Phase 1 reveals a clean JSON API covering all data points → skip Phase 2, go directly to Phase 3 validation.
