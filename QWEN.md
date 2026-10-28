# Pyramid Builder — house rules

- **SPEC.md is the binding contract.** Module exports, DOM ids, and constants other files read never change silently.
- **Node** is at `/home/coder/.nvm/versions/node/v24.21.0/bin/node` (not on daemon-shell PATH).
- **Tests:** `node tests/run.mjs` — 25 green as of 2026-10-28; run before any push.
- **Browser E2E:** serve the repo (`python3 -m http.server 8931 --directory .`) then `~/.local/bin/qwen-e2e game http://127.0.0.1:8931/`. Must be green before any deploy.
- **Deploy rule:** the Pages URL (https://willpatpost.github.io/pyramid-builder/) is the product of record — push ONLY complete, browser-verified states. Never leave the live URL serving an intermediate.
- **Commits:** short imperative subject, no AI attribution or co-author trailers, straight to main.
- **Org charters** live in `~/.qwen/agents/` (dept-lead, coder-worker, visual-qa). Workers' green self-checks are not verification — leads functionally verify, the head verifies seams and the live artifact.
- **Audio assets** (future voices/sounds/music): generate with `~/.local/share/qwen-tools/odu-tts.py` (kokoro/speaches-tts voices, fish-s2-pro for cloned character voices); drop wavs under assets/ and wire into js/sound.js.
