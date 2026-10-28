# Pyramid Builder

A beta-Minecraft-style desert survival game that runs entirely in the browser as a static site.

**Play:** https://willpatpost.github.io/pyramid-builder/

Mine the desert, craft tools from oasis palms, survive the mummies that rise at night — and raise a solid sandstone pyramid with a 15×15 base to win. Full controls and survival tips are in the game's How to Play screen.

- Pure static hosting: no build step, no runtime network calls, all textures and sounds procedural.
- THREE r128 vendored in `js/vendor/`.
- The module contracts, world rules, and win detection spec live in [SPEC.md](SPEC.md).

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Verify

```bash
node --check js/*.js
node tests/run.mjs
```
