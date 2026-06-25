# Phase 4: Productionization (Apify Actor)

## When to Use

Activate when user says: "deploy this", "make it run continuously", "productionize", "create an Actor".

## Step 1: TypeScript (STRONGLY RECOMMENDED)

TypeScript provides type safety and better tooling. Use it unless user explicitly requires JS.

## Step 2: Choose Template Based on Recon Findings

| Recon Result | Template |
|-------------|---------|
| Static HTML / simple HTTP | CheerioCrawler |
| JS-rendered (React/Vue/Angular) | PlaywrightCrawler |
| Heavy anti-bot (Cloudflare etc.) | PlaywrightCrawler with Camoufox |

## Step 3: Initialize Project

```bash
apify create my-scraper
# Select appropriate template
```

Never manually set up project structure — use `apify create` for correct config, linting, and TypeScript setup.

## Step 4: Port Logic

Wrap scraping logic in `Actor.main()`:

```ts
import { Actor } from 'apify';
import { CheerioCrawler } from 'crawlee';

await Actor.init();

const input = await Actor.getInput();
const { startUrls } = input;

const crawler = new CheerioCrawler({
  async requestHandler({ $, request }) {
    // your extraction logic here
    await Actor.pushData({ url: request.url, /* fields */ });
  },
});

await crawler.run(startUrls);
await Actor.exit();
```

## Step 5: Test → Deploy

```bash
apify run          # test locally
apify build        # build Docker image
apify push         # deploy to Apify platform
```

## Production vs Dev Differences

| Dev (proxy-mcp) | Production (Apify) |
|----------------|-------------------|
| interceptor_chrome_* | PlaywrightCrawler |
| proxy_set_upstream() | ProxyConfiguration |
| proxy_set_fingerprint_spoof() | fingerprint-suite |
| Manual traffic capture | Crawlee auto-handles |
