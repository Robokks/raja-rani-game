# Game Zone realtime server (Neon Racer)

Node.js + Socket.io server that hosts multiplayer rooms for race.html.

## Deploy free on Render (one time, ~2 minutes)

1. Go to https://render.com and sign in with your GitHub account
2. Click **New → Blueprint**
3. Pick the repository **robokks/raja-rani-game** (Render reads render.yaml automatically)
4. Click **Deploy** (free plan)
5. When it finishes, copy the service URL, e.g. `https://gamezone-race-server.onrender.com`
6. If the URL is different from `https://gamezone-race-server.onrender.com`,
   update the `SERVER_URL` constant near the top of `race.html` and push.

## Free plan note

The free server sleeps after ~15 minutes of no traffic. The first player to
open the race page wakes it up — the game shows "Waking up server…" and
connects automatically after ~30-60 seconds. After that it's instant for
everyone until it idles again.

## Run locally (development)

    cd server
    npm install
    npm start          # listens on http://localhost:3000

Open race.html via any local static server — it auto-targets localhost:3000.
