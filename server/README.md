# Game Zone on Render

One Render Blueprint deploys BOTH services from this repo:

| Service | What | URL after deploy |
|---|---|---|
| gamezone-portal | The whole website (all games, static) | https://gamezone-portal.onrender.com |
| gamezone-race-server | Realtime server for Neon Racer | https://gamezone-race-server.onrender.com |

## Deploy (one time, ~2 minutes)

1. Go to https://render.com and sign in with your GitHub account
2. Click **New → Blueprint**
3. Pick the repository **robokks/raja-rani-game** (Render reads render.yaml)
4. Click **Deploy** (both services are on the free plan)
5. Open https://gamezone-portal.onrender.com — the full site is live there
6. If Render assigned different URLs, update `SERVER_URL` near the top of
   `race.html` to the race-server URL and push.

Render auto-redeploys both services on every push to main.

## Notes

- The **static site never sleeps** — the portal and all Firebase games are
  always instant on Render, same as GitHub Pages.
- The **race server** (free plan) sleeps after ~15 idle minutes. The first
  player wakes it; the race page shows "Waking up server…" and connects
  automatically after ~30-60s.
- Turn-based games (Raja Rani, Bluff, Chess online, etc.) keep using
  Firebase Realtime Database — always-on, free, and rooms survive restarts.
- GitHub Pages (robokks.github.io/raja-rani-game) continues to work in
  parallel; both hosts serve the same code.

## Run the race server locally (development)

    cd server
    npm install
    npm start          # listens on http://localhost:3000

Open race.html via any local static server — it auto-targets localhost:3000.
