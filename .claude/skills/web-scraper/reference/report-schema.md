# Intelligence Report Schema (Phase 5)

Generate this report after reconnaissance. Self-critique section is mandatory.

---

## Section 1: Site Architecture

```
Framework:       [Next.js / WordPress / Shopify / React SPA / Static HTML / ...]
Rendering:       [SSR / CSR / SSG / Hybrid]
Detection Method:[headers / HTML signature / traffic analysis]
CDN/Proxy:       [Cloudflare / Fastly / none / unknown]
```

## Section 2: Data Points Requested

| Data Point | Location | Extraction Method | Validated? |
|-----------|----------|------------------|-----------|
| Product title | Raw HTML | `#productTitle` CSS selector | YES |
| Price | Rendered DOM | `span.a-price .a-offscreen` | YES |
| Reviews | API | `GET /api/reviews?id={id}` | PARTIAL |
| Stock | Unknown | — | NO |

**Validation statuses:**
- `YES` — tested, confirmed returns expected value
- `PARTIAL` — identified but not fully verified
- `NO` — theoretical only, not tested

## Section 3: Discovered Endpoints

| Endpoint | Method | Auth | Rate Limit | Notes |
|---------|--------|------|-----------|-------|
| `/api/v1/products` | GET | Bearer token | ~60 req/min | Paginated via `?page=` |
| `/graphql` | POST | Cookie | Unknown | Products + reviews |

## Section 4: Protection Assessment

```
Protection Level:  [none / low / medium / high]
Cloudflare:        [yes / no / unknown]
CAPTCHA:           [yes / no / not triggered]
IP Rate Limiting:  [yes / threshold=X / no]
TLS Fingerprint:   [checked / not checked]
Phases Tested:     [0, 1, 2] / skipped Phase 4 because: [reason]
Minimum Access:    [curl / stealth browser / proxy + stealth / TLS spoof]
```

## Section 5: Extraction Strategies (ranked)

1. **[Strategy name]** — covers X/Y data points, complexity: low
2. **[Fallback strategy]** — covers remaining points, complexity: medium

## Section 6: Implementation Checklist

- [ ] Use `[strategy]` for `[data points]`
- [ ] Auth: `[how to obtain token/cookie]`
- [ ] Pagination: `[how to paginate]`
- [ ] Rate limit: `[recommended delay]`
- [ ] Error handling: `[retry on 429, skip on 404]`

## Section 7: Self-Critique (mandatory)

**Data gaps:** [list any data points that are NO or PARTIAL]
**Skipped phases:** [list any skipped phases and why]
**Unvalidated claims:** [list anything marked PARTIAL]
**Staleness risk:** [will selectors/endpoints break? when?]
**Assumptions made:** [list any assumptions not verified]
**Recommended deeper investigation:** [specific follow-up actions]
