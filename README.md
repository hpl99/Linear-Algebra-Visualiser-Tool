# Linear Algebra Visualiser Tool — Enhancement Branch

This branch (enhancement/theme-audio-performance) adds the following consolidated features in one commit:

- Theme: Light theme variables and a persistent theme toggle (respects prefers-color-scheme and stores choice in localStorage).
- Audio: Expanded ambient playlist (Deep Space, Orbital, Cosmic Drift, Lo-fi Study, Glass Chimes) and support for uploading a custom audio track. Added AnalyserNode plumbing and master/track gain controls.
- Performance: Lightweight mesh pooling for reusable spheres (draggable endpoints) and an InstancedMesh helper intended for vector-cloud / particle-heavy experiments (fallback to pooled meshes if InstancedMesh not supported).
- Accessibility: focus-visible outlines, numeric inputs next to sliders (audio volume, flow progress), and ARIA labels on key buttons.
- UI: Added numeric inputs synced with range sliders, and improved responsive behaviour for small screens.
- Dev: Small README and changelog entry.

How to test quickly

1. Open index.html in a browser that supports WebGL and the Web Audio API.
2. Toggle Settings → Light Theme to switch between dark and light modes.
3. Open Ambient (M) and try the different tracks; adjust volume with either the slider or numeric input.
4. Upload an audio file using the Upload Track button — it will play as the custom track and be selected as 'Custom'.
5. Verify dragging endpoints, inspect mode, and that performance remains smooth. For large vector clouds, the instancing helper will be used when enabled in experiments.

Files changed in this commit

- index.html — added numeric inputs and upload controls.
- styles.css — added numeric input styles and accessibility helpers.
- app.js — added mesh pooling, InstancedMesh helper, numeric input bindings, README references, and audio enhancements.
- README.md — this file.

Notes / Next steps

- If you want, I can extend the InstancedMesh usage to automatically convert existing experiments 15 and 17 to use instancing by default; currently a helper function is provided and can be invoked from the experiment renderer when appropriate.
- We can also wire more aggressive caching strategies (geometry/material caches) and add optional debug instrumentation to log draw calls and pool reuses.

