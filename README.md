# Game Zone

Tamil and English multiplayer games and single-player arcade games, hosted on GitHub Pages.

## Run locally

Serve this directory with a static HTTP server (for example, `python3 -m http.server 8080`), then open `http://localhost:8080`.

Multiplayer games use the configured Firebase database; local pages still connect to that database. Use a separate test database for multiplayer integration testing. Neon Racer has a separate server; see `server/README.md`.

## Regression checks

Run `npm test` with Node.js 22 or newer. These dependency-free checks cover inline JavaScript syntax, local script links, arcade restarts and collision handling, pause controls, and Raja Rani room-write conflicts using a simulated transaction backend. They do not replace real-browser or Firebase integration testing.

Before release, verify:

- Raja Rani: simultaneous joins, a complete round, next round, rematch, and disconnect/reconnect on separate devices.
- Highway Rush: crash after driving a long distance, replay with road visible, and pause/resume.
- Fruit Slash: start with a swipe, restart after a bomb, and cancel a touch gesture.
- Space Blaster: keyboard/touch controls, damage invulnerability, and restart.
- All three arcade games: switch apps while holding a control, return to the paused screen, and explicitly resume.

## Arcade controls

Highway Rush, Fruit Slash, and Space Blaster support the on-screen **Pause** button and **P / Escape**. Switching apps or hiding the tab pauses play and releases held controls. Use **Resume game**, **Enter**, **Space**, **P**, or **Escape** to continue.
