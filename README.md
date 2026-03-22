# SEC3ENGINE WebGL Experiments

SEC3ENGINE hosts several WebGL sandboxes focused on modern real-time rendering techniques: a deferred renderer with cascaded PCF shadow maps, GPU-driven particle systems, a screen-space post-processing suite, and a GPU SPH fluid simulator. Use the pages in this repository to launch each experiment directly in the browser.

## Demos

- **Main SEC3 demo (`index.html`)** – deferred lighting plus a GPU particle system rendered against cascaded shadow maps and post-processing outputs.
- **Particle sandbox (`particleDemo.html`)** – standalone particle UI for experimenting with particle counts, gravity, transparency, and point size.
- **Engine bootstrap (`Sec3Engine/sec3index.html`)** – minimal page wiring the engine modules manually for custom experiments.

Run the pages from a local HTTP server so shaders, textures, and models load correctly.
For day-to-day development, use the Vite dev server for automatic reloads:

```bash
npm install
npm run dev
```

Then open the desired page, e.g. `http://127.0.0.1:5173/index.html` or `http://127.0.0.1:5173/particleDemo.html`.

For quick startup that also opens the main demo automatically:

```bash
npm run dev:open
```

To run a one-command smoke check before/after changes:

```bash
npm run smoke
```

To run optional browser-backed smoke checks (Chrome/Chromium required; tests auto-skip when unavailable):

```bash
npm run smoke:browser
```

If you want a no-dependency fallback static server, this still works:

```bash
python3 -m http.server 8000
```

## Repository layout

```
SEC3ENGINE/
├── Sec3Engine/          # Engine core, demos, shaders, textures, and assets
├── index.html           # Main deferred-rendering + GPU particle demo
├── particleDemo.html    # Particle-system playground
└── Sec3Engine/sec3index.html # Minimal engine bootstrap
```

## Engine highlights

- **Deferred renderer with cascaded PCF shadows** – Builds a G-buffer, renders cascaded shadow maps, and filters them with a multi-tap PCF kernel before combining lighting in a deferred pass.【F:Sec3Engine/js/core/renderer.js†L10-L63】【F:Sec3Engine/shader/deferredRenderPass2.frag†L1-L66】
- **GPU particle simulation (N-body)** – Particle positions and velocities are advanced entirely on the GPU using floating-point textures and framebuffer ping-ponging, then drawn with scene depth and light-aware shading.【F:Sec3Engine/js/core/ParticleSystem.js†L24-L99】【F:Sec3Engine/js/core/ParticleSystem.js†L100-L170】
- **GPU SPH fluid simulator** – A Smoothed Particle Hydrodynamics pipeline runs on the GPU with tiled bucket textures, density/pressure passes, and instanced rendering of particle meshes.【F:Sec3Engine/js/core/SPH.js†L1-L75】【F:Sec3Engine/js/core/SPH.js†L210-L283】
- **Post-processing stack** – Gaussian blur, depth-of-field downsampling/combination passes, and additive compositing utilities for building effect chains atop the deferred output.【F:Sec3Engine/js/core/postFx.js†L12-L118】【F:Sec3Engine/js/core/postFx.js†L118-L191】
- **Asynchronous loading & utility layer** – Shader programs, OBJ meshes, framebuffers, and textures load asynchronously and register callbacks before rendering begins, making it easy to extend demos with new assets and shaders.【F:Sec3Engine/js/core/renderer.js†L10-L35】【F:Sec3Engine/js/core/obj-loader.js†L1-L80】

## Tips

- WebGL extensions such as `OES_texture_float`, `WEBGL_draw_buffers`, and instancing (`ANGLE_instanced_arrays`) are required for the GPU simulations; use a modern browser.
- Check the developer console for shader compile or network errors if a canvas is blank.
- To prototype new effects, add scripts in `Sec3Engine/demos/` and hook them into a lightweight HTML wrapper similar to `sec3index.html`.
