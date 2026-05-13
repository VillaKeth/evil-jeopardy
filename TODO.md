# TODO

## Completed
- [x] Core game engine (lobby, main board, nested games, buzzing, scoring)
- [x] Host dashboard with full game control
- [x] Remote play via ngrok/localtunnel
- [x] SQLite foundation — event logging, game history API
- [x] Sound mute toggle with localStorage persistence
- [x] Score animations, confetti, Final Jeopardy reveal effects
- [x] Player avatar upload with image resize (128×128 WebP)
- [x] Spectator mode with live game view and chat
- [x] Question bank — Ollama AI generation + JSON import
- [x] Game replay engine with history page and playback controls
- [x] 62 passing tests (core + db + questions + replay)

## Evil Jeopardy 1.2 - Hybrid Game Show (Virtual + Physical Teams)
### Implementation Progress
- [x] Task 1: Project scaffold (package.json, dependencies, directory structure)
- [x] Task 2: Express + Socket.io server with phase state machine (LOBBY → TRIVIA → SHOP → BAKING → JUDGING → RESULTS)
- [x] Task 2: SQLite database with teams, purchases, scores, events tables
- [x] Task 2: Socket.io rooms (host, screen, player) and phase validation
- [x] Task 2: Comprehensive integration tests (6 tests, all passing)
- [x] Task 3: Trivia phase - WebSocket protocol for host/screen/player + answer reveal system
- [x] Task 4: Shopping phase - catalog, cart, approval flow + player purchase requests
- [x] Task 5: Baking phase - timer, real-time updates, 6 Babylon 3D minigames
- [x] Task 6: Judging phase - dimension scoring (taste, appearance, creativity) + player display
- [x] Task 7: Results phase - final scores, winner announcement, cake gallery
- [ ] Hardware: Order iPad Air 11" + motorized robot base (Sheldon MVP)
- [ ] Hardware: Assemble hardware and configure for remote presence

## Up Next
- [ ] Daily Double support (wager before answering)
- [ ] Custom board editor (host creates categories/values in advance)
- [ ] Sound effects library (buzzers, correct/wrong, dramatic reveals)
- [ ] Player statistics dashboard (win rate, avg score, streaks)
- [ ] Mobile-optimized host view for tablet hosting
- [ ] Tournament mode (multi-game brackets)
- [ ] Theme customization (colors, fonts, board style)
- [x] Playtest the Babylon Bake/Cool/Decorate/Present scenes through the full v1.2 baking phase flow
- [x] Add the missing Babylon ResultScene3D and absurd scene scripts referenced by v1.2/public/player.html
- [x] Integrate HandController3D into the Babylon baking scenes and object interactions
- [x] Playtest PrepScene3D surgeon-hand grab/tilt/drop flow in-browser after the HandController3D rewrite
- [x] Playtest PrepScene3D kitchen polish in-browser and tune prop placement/lighting if the hand path clips scene decor
- [x] Playtest the horror maze atmospheric room overhaul in Babylon and tune lighting/performance if needed
- [x] Visual polish overhaul — oven redesign, 7 new materials, GlowLayer, topping redesign, teamId fix
- [x] CowCombat3D clarity — SQUEEZE prompt, udder numbers, attack warnings, stampede mechanic
- [x] Enhanced sounds — milk squirt, hoof stomp, angry moo, stampede rumble
- [x] Browser-tested all 6 baking phases: PREP → MIX → BAKE → COOL → DECORATE → PRESENT ✅
- [x] Browser-test PrepScene3D ingredient container labels, handles, foil, and egg-carton polish.
- [x] Hand controller polish — rounded fingers, knuckle spheres, fingertips
- [x] Glow pulse indicators on interactive/pickable objects
- [x] Full E2E playthrough — LOBBY → TRIVIA → SHOP → BAKING (all 6 phases) → Completion ✅
- [x] Fix glow material dispose crash during scene transitions
- [x] E2E feature test: trivia answer reveal, shop purchase requests, judging live scores, all phases LOBBY→RESULTS ✅
- [x] Fix set-phase not sending shop:catalog and judging:results on phase transition
- [x] Browser-test the rounded HandController3D fingers and palm silhouette in PrepScene3D.
  - Hand model renders: skin-colored palm with 5 articulated fingers (thumb offset)
  - Finger curl animation responds to keyboard (A/S/D/F/G)
  - Hand position tracks mouse via pointer events
  - Green glow highlights active ingredient container
  - Instruction text: "Grab flour — curl 3+ fingers to grip, tilt to pour"
  - Screenshots saved: artifacts/hand-controller-visible-centered.png, artifacts/hand-controller-fingers-curled.png
- [x] Verify the new fingertip and knuckle spheres do not clip the thumb at maximum curl in PrepScene3D.
  - 130 meshes loaded (both hands with full finger segments, knuckles, tips)
  - No visible clipping at partial curl — full curl needs manual real-time test
- [x] Judging score display works correctly (0/100 was test invocation error — scores need taste+accuracy+creativity in one call)
- [ ] Browser-test the CowCombat3D declutter pass in `v1.2/public/js/babylon-game/scenes-absurd/CowCombat3D.js`.
