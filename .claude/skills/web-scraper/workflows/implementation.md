# Phase 3: Iterative Implementation

## Core Rule: Small Batch First

Never implement at full scale immediately. Always test on 5–10 items first.

## Step 1: Minimal Implementation

Write the simplest possible scraper using the strategy from reconnaissance:
- Cheerio: HTTP fetch + CSS selector
- API: got-scraping + JSON path
- Browser: Playwright + accessibility tree

## Step 2: Validate on Sample

Checklist before scaling:
- [ ] Data structure matches expected schema
- [ ] All required fields present (no empty/null)
- [ ] No errors or exceptions on sample
- [ ] Performance acceptable (requests/sec)

## Step 3: Scale or Pivot

**If sample passes** → run full dataset, add robustness layer.

**If sample fails** → pivot strategy:
1. Cheerio → API (check if traffic revealed an endpoint)
2. Cheerio → Playwright (data is JS-rendered)
3. Direct API → traffic interception (find correct endpoint)
4. One API → sitemap + API hybrid

## Step 4: Handle Blocking

Identify block type, then apply targeted fix:

| Block Type | Symptom | Fix |
|-----------|---------|-----|
| Rate limiting | 429 / slow responses | Add delays, exponential backoff |
| IP ban | 403 on all requests | Rotate proxies |
| Bot detection | CAPTCHA / JS challenge | Stealth browser |
| Fingerprinting | Blocked despite stealth | TLS spoof (HTTP only) |

## Step 5: Robustness Layer

Add after successful small-batch test:
- Retry logic with exponential backoff (2s, 4s, 8s, 16s)
- Per-item error handling (log + continue, don't crash)
- Progress tracking (how many done / total)
- Data validation on each extracted item
- Output deduplication
