# Anti-Blocking & Anti-Detection

## 5-Layer Escalation (stop at the layer that works)

### Layer 1: Stealth Browser (always use on protected sites)
- Patches `navigator.webdriver` → `undefined`
- Cleans error stack traces
- Spoofs `chrome.runtime`, `permissions.query`

```js
interceptor_chrome_launch(url, { stealthMode: true })
```

### Layer 2: Behavioral Mimicry
- Bezier curve mouse paths (not linear)
- WPM-based typing delays
- Natural scroll with micro-jitter during idle

```js
await humanizer_click(selector)     // not page.click()
await humanizer_type(selector, text) // not page.fill()
await humanizer_idle({ minMs: 1000, maxMs: 3000 })
```

### Layer 3: Proxy Rotation (for IP bans)
- Residential IPs bypass most IP-based blocks
- Geo-targeting for region-locked content

```js
proxy_set_upstream("http://user:pass@residential-proxy:port")
```

### Layer 4: TLS Fingerprint Spoofing (HTTP clients ONLY)

**WARNING: Do NOT use with Chrome browser sessions.**
Chrome already has a valid fingerprint. TLS spoof is only for `gotScraping`/`curl`/`fetch`.

```js
proxy_set_fingerprint_spoof({ preset: "chrome_latest" })
// Then use got-scraping for HTTP requests
```

### Layer 5: Request Manipulation (edge cases)
- URL rewriting (change query param order)
- Response mocking for specific detection vectors
- Custom header injection

## Rate Limiting Defaults

```js
// Conservative — good for most sites
const DELAY_MS = 1000 + Math.random() * 2000; // 1–3s between requests
const CONCURRENT = 2;

// Aggressive — only with proxies + stealth
const DELAY_MS = 200 + Math.random() * 300;
const CONCURRENT = 5;
```

## Detection Signals to Watch

| Signal | Means | Fix |
|--------|-------|-----|
| 429 Too Many Requests | Rate limited | Increase delay |
| 403 Forbidden | IP banned | Rotate proxy |
| Cloudflare challenge page | Bot detected | Stealth browser |
| CAPTCHA | Bot detected | Stealth + humanizer |
| Redirect to `/sorry` | Google rate limit | Slow down + proxy |
| Empty response / hanging | IP blocked | Proxy + backoff |

## Most Sites Only Need Layers 1–2

Don't over-engineer. Test Layer 1 first — most modern sites are satisfied by stealth mode alone.
