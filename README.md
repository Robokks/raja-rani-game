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

## Highway Rush graphics

The Coastline edition uses the bundled Three.js renderer with procedural car geometry and textures. Its art assets are generated locally; there are no external model or texture downloads. The garage offers four car paint colours and three graphics settings:

- **Auto** caps resolution for the device and reduces detail after sustained slow frames.
- **High detail** enables dynamic shadows and a higher resolution cap.
- **Smooth** uses a lower resolution cap and baked contact shadows for lighter rendering.

The upgrade includes reflective car paint/glass, wheel detail, braking lights, coastal terrain, palms, ocean, directional signs, sunset lighting and a damped chase camera. The game still uses the original traffic, scoring, pause and restart rules.

`tests/highway-scene.test.js` checks real geometry, camera/recycling logic and quality settings without a GPU. These checks do **not** validate GLSL shader compilation, visual appearance or real-device frame rate. Browser visual QA is required before treating the graphics upgrade as release-ready.

### Browser graphics check

`node tests/highway-browser.cjs` serves the checkout on loopback, blocks external requests and checks the game in desktop and phone-sized Chromium sessions. Install the project's dependencies and Playwright Chromium first. The `Highway graphics browser check` workflow captures garage/driving screenshots and a JSON report as a seven-day build artifact. Software rendering verifies shaders and controls; it is not a real-phone performance benchmark.
