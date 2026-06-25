# Proxy Escalation & Protection Testing

## When to SKIP Phase 4

Skip if ALL of these are true:
- No 403/429/challenge pages during Phases 0–2
- All data points validated
- User did not request "full recon"
- Low-volume / one-time extraction

## When to ALWAYS RUN Phase 4

Run if ANY of these:
- 403, Cloudflare challenge, CAPTCHA, or "Access Denied" observed
- Site is known high-protection (LinkedIn, airlines, ticketing)
- User mentions: continuous scraping, monitoring, thousands of pages
- Geo-blocking detected (different content by IP/region)

## Escalation Sequence (stop when access confirmed)

### Level 1: Raw HTTP
```bash
curl -s -o /dev/null -w "%{http_code}" https://target.com/page
```
- 200 → use Cheerio/HTTP client, no browser needed
- 403/503 → escalate to Level 2

### Level 2: Stealth Browser
```js
interceptor_chrome_launch(url, { stealthMode: true })
```
- Page loads → stealth browser sufficient
- Challenge persists → escalate to Level 3

### Level 3: Upstream Proxy
```js
proxy_set_upstream("http://user:pass@proxy-provider:port")
```
- Access granted → note proxy requirement in report
- Still blocked → escalate to Level 4

### Level 4: TLS Fingerprint Spoofing
```js
proxy_set_fingerprint_spoof({ preset: "chrome_latest" })
// Use with HTTP client (gotScraping) — NOT with Chrome browser
```
- Access granted → note fingerprint + proxy requirement
- Still blocked → document as high-protection, recommend specialist

## Report Output (Section 4)

- What levels were tested
- Minimum access level that worked
- What was skipped and why
- Production implications (what the deployed scraper will need)
