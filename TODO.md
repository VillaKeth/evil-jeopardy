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
- [ ] Task 3: Trivia phase - WebSocket protocol for host/screen/player
- [ ] Task 4: Shopping phase - catalog, cart, approval flow
- [ ] Task 5: Baking phase - timer, real-time updates
- [ ] Task 6: Judging phase - dimension scoring (taste, appearance, creativity)
- [ ] Task 7: Results phase - final scores, winner announcement
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
- [ ] Playtest the Babylon Bake/Cool/Decorate/Present scenes through the full v1.2 baking phase flow
- [ ] Add the missing Babylon ResultScene3D and absurd scene scripts referenced by v1.2/public/player.html
- [ ] Integrate HandController3D into the Babylon baking scenes and object interactions
