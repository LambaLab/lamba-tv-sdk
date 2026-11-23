# Kit issues log

Every problem met while building an app with the kit alone gets a row the same day. Newest first.
Columns: date | what broke or was missing | kit fix or app fix | doc or check changed.

| Date | What broke or was missing | Fix | Doc or check changed |
| --- | --- | --- | --- |
| 2026-11-23 | `LambaGame.award` gave places by seat order to Players who did nothing, and could not share a place on a true tie (review of Party Pack) | Kit fix: `rank(rows, low, ties)` returns tie groups and `award` takes a tied list as one place; docs say to leave out a Player who did nothing | docs/sdk/SDK.md, lamba.d.ts |
| 2026-11-23 | Pause did not stop a game's own wall-clock timers (a question's time, a reaction time, a reveal) | App fix: one game clock that excludes paused time | none |
| 2026-11-23 | `phone-viewports.test.mjs` flagged the lobby keys: Ready hid itself after the tap and Change animal swapped the whole view, so keys moved or vanished under a finger | App fix: keys keep their place (a dimmed key with aria-disabled, not a disabled one that sinks), the animal picker opens in place of the picture above the same key | none (the template's rule worked as meant) |
| 2026-11-23 | A game of 20 to 45 s rounds takes minutes to test, and `LambaSim` shows at most 6 Players | App fix: the test plays a copy of the app with shorter clocks and checks the 8 Player layout with 8 pills in the DOM; no kit change | none |
| 2026-11-23 | The join card sat over the Players' score pills mid game and over the podium at the end | App fix: the card only in the lobby (the Host's Join code choice does the rest) | none |
| 2026-11-23 | `tests/sdk-schema.test.mjs` already failed before this work (the `home` field in section 3, and `W.location` in section 4 when it runs lamba.js) | Not fixed here: not caused by the kit changes (lamba.js is untouched); listed so it is not blamed on them | none |
| 2026-11-23 | `lamba test` said "the screen never heard it" for Host tiles the screen had greyed on purpose (Skip round and End game before a game) | Kit fix: `lamba test` skips a greyed action tile and says so | kit/lamba-test.mjs |
| 2026-11-23 | `lamba check` refused a Count the Sloths remote: a - and + pair of keys is read as a stepper for a setting, but here it is a game move | App fix: icon keys labelled "One more sloth" and "One fewer sloth" (the check reads labels, not pictures) | docs/sdk/UI.md "A counter that is a game move" |
| 2026-11-23 | Each Player picks their own animal and colour: settings are shared by everyone, so there was no per-Player pick, no animal set with a sloth and no colour strip ending in "Your own colour" | Kit fix: `LambaGame.animals` (sloth included), `LambaGame.colours`, `LambaGame.mark`, and `LambaUI.swatches` | docs/sdk/SDK.md, docs/sdk/UI.md, AGENTS.md rule 13, lamba.d.ts |
| 2026-11-23 | A game with a round clock, points, a playlist and sliding bars had to write all of it by hand | Kit fix: `LambaGame` (shell/sdk/game.js: playlist, award, rank, clock, bars, confetti) | docs/sdk/SDK.md "Party games", AGENTS.md rule 13, skill patterns.md, lamba.d.ts, `lamba check` (LambaGame without game.js) |
| 2026-11-23 | Swipe a thing to another Player: no swipe helper, each app would write its own touch maths | Kit fix: `LambaUI.swipe` | docs/sdk/UI.md "A swipe", AGENTS.md rule 13, patterns.md, lamba.d.ts, `lamba check` (needs ui.js) |
| 2026-11-23 | Trace a shape with a finger and score it: no helper | Kit fix: `LambaUI.trace` with `trace.score` and `trace.shapes` | docs/sdk/UI.md "Trace a shape", AGENTS.md rule 13, patterns.md, lamba.d.ts |
| 2026-11-23 | Rocket Pump and Freeze need "is the phone moving now": `tilt` hides small moves, `shake` needs three pushes and 0.7 s between | Kit fix: `Lamba.motion.on("energy", fn)`, `level` 0 to 1, ten a second (real sensors and simulator) | docs/sdk/SENSORS.md, AGENTS.md rule 13, patterns.md, lamba.d.ts |
| 2026-11-23 | The simulator and `lamba-test` only served lamba.js, ui.js and ui.css from shell/sdk | Kit fix: game.js added to the simulator's SDK files and to the self-test bundle | tools/sdk_kit.mjs SIM_FILES, devs/simulator/sim.js |
