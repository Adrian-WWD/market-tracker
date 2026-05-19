# PRKT/TERMINAL

A terminal-style prediction market tracker and AI trade advisor for Kalshi and Polymarket.

## Features

- **Live market feed** — Kalshi + Polymarket, filtered by Politics, Economics, Current Events
- **Arbitrage detection** — flags same markets trading at different prices across platforms
- **Signal panel** — click any market for stats + AI analysis
- **AI Trade Advisor** — Claude-powered trade recommendations (BUY / WATCH / PASS)
- **Portfolio tracker** — log positions, track P&L
- **Watchlist** — save markets for quick access
- **Light/dark mode** toggle
- **Auto-refresh** every 5 minutes

## Setup

No build step. Just open `index.html` in a browser.

### API Keys

Go to **Settings** in the app and enter:

| Key | Where to get it |
|-----|----------------|
| Kalshi API key | [kalshi.com](https://kalshi.com) → Account → API |
| Polymarket API key | [polymarket.com](https://polymarket.com) → Gamma API docs |
| Anthropic API key | [console.anthropic.com](https://console.anthropic.com) |
| CORS Proxy URL | See below |

Keys are saved to your browser's `localStorage` — never sent anywhere except directly to the respective APIs.

If no keys are provided, the app falls back to representative demo data.

### CORS Proxy (for live market data)

Direct browser requests to Kalshi and Polymarket may be blocked by CORS. Deploy a lightweight proxy:

**Cloudflare Worker** (free tier, recommended):

```js
export default {
  async fetch(request) {
    const url = new URL(request.url).searchParams.get('url');
    if (!url) return new Response('Missing url param', { status: 400 });
    const headers = new Headers(request.headers);
    headers.delete('origin');
    const res = await fetch(url, { method: request.method, headers });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
```

Deploy to `your-worker.workers.dev`, then paste that URL into **Settings → CORS Proxy URL**.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo
2. Go to **Settings → Pages**
3. Set source to `main` branch, `/ (root)`
4. Live at `https://yourusername.github.io/repo-name`

## File structure

```
├── index.html   — markup and layout
├── style.css    — terminal theme, light/dark mode
├── app.js       — all logic: API calls, AI advisor, portfolio, watchlist
└── README.md
```
