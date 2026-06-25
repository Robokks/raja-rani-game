# Web Scraping with Intelligent Strategy Selection

Activate automatically when user requests: "Scrape [website]", "Extract data from [site]", "Get product info", finding links, handling blocking, or productionizing scrapers.

## Reconnaissance Modes

| Mode | Use Case | Phases |
|------|----------|--------|
| Quick | "What framework?" simple checks | Phase 0 only |
| Standard | Default extraction requests | Phases 0–3, 5 + Phase 4 if protection detected |
| Full | Production intent, deep analysis | All phases 0–5 |

## Five-Phase Adaptive Workflow

**Phase 0 — Quick Assessment**
Single curl request: check headers, HTML signatures, framework detection, data presence, protection signals.
Quality gate: "Do I have enough?" → if yes, skip to Phase 3.

**Phase 1 — Browser Reconnaissance** (only if Phase 0 insufficient)
Launch stealth Chrome + MITM proxy. Capture rendered DOM and network traffic. Discover REST/GraphQL endpoints.
See: `workflows/reconnaissance.md`, `strategies/traffic-interception.md`

**Phase 2 — Deep Scan** (only if Phase 1 insufficient)
Click, scroll, search — trigger dynamic content. Sniff API pagination patterns.

**Phase 3 — Validate Findings**
Every claimed extraction method MUST be tested. CSS selectors, JSON paths, API endpoints — verify each returns expected data.
See: `strategies/cheerio-vs-browser-test.md`

**Phase 4 — Protection Testing** (conditional)
Test raw HTTP → stealth browser → upstream proxy → TLS spoof. Stop at the level that works.
See: `strategies/proxy-escalation.md`, `strategies/anti-blocking.md`

**Phase 5 — Report + Self-Critique**
Generate intelligence report. Identify gaps, unvalidated claims, staleness risks.
See: `reference/report-schema.md`

## Implementation Pattern (after reconnaissance)

1. Implement minimally — test on 5–10 sample items
2. Validate data quality (structure, completeness, errors)
3. Scale to full dataset OR pivot to alternate strategy
4. Add robustness: retry + exponential backoff, error handling, progress tracking

See: `workflows/implementation.md`

## Strategy Selection

| Site Type | Recommended Strategy |
|-----------|---------------------|
| Static HTML | Cheerio (HTTP-only) — fastest |
| JS-rendered (React/Vue/Next) | Playwright/DevTools |
| Has internal API | Direct API calls — 10–100× faster |
| Large site (100+ pages) | Sitemap discovery first |
| Anti-bot protection | Escalate: stealth → proxy → TLS spoof |

## Key Principles

- **Start cheap**: curl first, browser only if needed
- **Detect framework first**: then search relevant patterns only — never shotgun-search
- **Validate before claiming**: "found in HTML" ≠ extractable — test the selector
- **API over DOM**: if traffic reveals an API, use it directly
- **Skip phases**: when quality gate passes, move on — don't over-investigate

## File Map

```
workflows/
  reconnaissance.md    — Phase 1 browser+traffic capture detail
  implementation.md    — Phase 3 iterative build pattern
  productionization.md — Apify Actor deployment

strategies/
  framework-signatures.md      — Header/HTML signatures → framework detection
  cheerio-vs-browser-test.md   — Decision matrix: HTTP vs browser
  traffic-interception.md      — MITM proxy API discovery
  api-discovery.md             — REST/GraphQL patterns
  sitemap-discovery.md         — robots.txt + sitemap parsing
  dom-scraping.md              — DevTools accessibility tree extraction
  proxy-escalation.md          — Protection testing escalation sequence
  anti-blocking.md             — 5-layer anti-detection strategy
  session-workflows.md         — Auth session handling

reference/
  report-schema.md    — Phase 5 intelligence report structure
  anti-patterns.md    — Common mistakes to avoid
  regex-patterns.md   — Useful extraction regex
  proxy-tool-reference.md — Proxy tool quick reference
```
