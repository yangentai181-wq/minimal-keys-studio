# SDD ledger — plan: docs/superpowers/plans/2026-08-05-opus-uiux-remediation.md

Baseline: commit 7324f07; `npm test` 94 files / 601 tests passed.
Task 1: fix round 1/5 (4 addressed, 0 open — HID read failure state, ambiguous serial selection, production cleanup coverage, listener ordering; commits b9d7499..292248f)
Task 1: complete (commits 7324f07..292248f, review clean)
Task 1: note — strict Clippy remains blocked by 13 pre-existing diagnostics in gatt.rs, commands.rs, and serial.rs; final verification must resolve or adjudicate these before completion.
Task 2: fix round 1/5 (2 addressed, 0 open — settings retry lifecycle and covering UI test; commits b0cf755..6cbf097)
Task 2: complete (commits 292248f..6cbf097, review clean)
Task 3: final implementation ready for review (active-tab session boundary, guarded explicit disconnect, unexpected-loss snapshot/restore, Encoder/HoldTap draft preservation; focused 37 tests, full 650 tests, lint/build/Tauri build pass)
Task 3: fix round 2/5 (3 addressed, 0 open — explicit precision reload confirmation, failed precision discard navigation, tested aborted/unexpected notification-end classification; focused 43 tests, full 654 tests, lint/build/Tauri build pass)
Task 3: fix round 3/5 (1 addressed, 0 open — successful precision discard replaces its dirty draft with fetched device settings; focused 30 tests, full 658 tests, lint/build/Tauri build pass)
Task 3: complete (commits f707b94..c265f45, independent re-review clean — Critical 0 / Important 0 / Minor 0)
Task 4: implementation ready for review (22 audited failure paths centralized in Japanese copy, toast regression scan added; focused 2 tests, full 660 tests, lint/build/Tauri build pass)
Task 4: fix round 1/5 (3 addressed, 0 open — normalized connection errors, renderer regression protection, live CW/CCW encoder recovery messages; focused 27 tests, full 665 tests, lint/build/Tauri build pass)
Task 4: fix round 2/5 (1 addressed, 0 open — App device-info failure normalizes before toast; focused 24 tests, full 666 tests, lint/build/Tauri build pass)
Task 4: fix round 3/5 (2 addressed, 0 open — safe ErrorBoundary fallback and single modal connection-failure surface; focused 30 tests, full 666 tests, lint/build/Tauri build pass)
Task 4: complete (commits 79fd40e..f28ce0f, independent re-review clean — Critical 0 / Important 0 / Minor 0)
Task 5: fix round 3/5 (1 addressed, 0 open — connected AppInner performance integration test proves Raw HID pointer frames update only the monitor leaf; focused 1 test, full 673 tests, lint/build/Tauri build pass)
