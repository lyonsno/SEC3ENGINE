# SEC3ENGINE

A collection of WebGL rendering demos plus a lightweight engine prototype. The repository includes multiple HTML entry points and the `Sec3Engine` source tree (core, math helpers, third-party utilities, shaders, textures, and sample models).

## Project layout
- **`index.html`** – Loads the Sec3Engine core and runs the `SEC3DEMO` scene inside a canvas.
- **`particleDemo.html`** – Alternate entry that focuses on the particle system.
- **`Sec3Engine/`** – Engine sources and assets:
  - `js/core`: scene graph, renderer, and runtime helpers.
  - `js/math`: small math/geometry utility layer.
  - `js/3party`: third-party JavaScript helpers used by the engine.
  - `shader`: GLSL programs consumed by the demos.
  - `textures` and `models`: sample assets (Sponza, spheres, planes, cube world, etc.).
  - `demos` / `misc`: additional experiments and supporting files.
- **`NoEngines/`** – Legacy demo without the engine abstraction; open `NoEngines/index.html` to compare behaviors.

## Running locally
Serve the repo root so the demos can load their assets via HTTP. The simplest option uses Python:

```bash
python -m http.server 8000
```

Then open one of the pages in your browser:
- Main demo: `http://localhost:8000/index.html`
- Particle demo: `http://localhost:8000/particleDemo.html`
- Engine sample page: `http://localhost:8000/Sec3Engine/sec3index.html`
- Legacy comparison: `http://localhost:8000/NoEngines/index.html`

> If you change ports, update the URLs accordingly.

## Capturing screenshots with Playwright
Automate visual checks using the helper script. It works both locally (with Playwright installed) and inside this workspace via the built-in Playwright runtime.

```bash
python scripts/playwright_capture.py --url http://localhost:8000/index.html --out artifacts/home.png --wait 1500
```

Flags:
- `--url`: page to open.
- `--out`: where to save the screenshot (directories are created automatically).
- `--wait`: optional delay in milliseconds after navigation (defaults to `0`).
- `--width` / `--height`: viewport size (defaults to `1280x720`).

### Workspace usage
If you are in the ChatGPT/Codex workspace, start the local server and call `browser_container.run_playwright_script` to reuse the Playwright runtime without installing anything:

```python
from browser_container import run_playwright_script

run_playwright_script(
    ports_to_forward=[8000],
    script="""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=[\"--no-sandbox\", \"--disable-dev-shm-usage\"])
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await context.new_page()
        await page.goto('http://127.0.0.1:8000/index.html')
        await page.wait_for_timeout(1000)
        await page.screenshot(path='artifacts/example.png', full_page=True)
        await browser.close()

asyncio.run(main())
""",
)
```

> Note: The Python `playwright` package is optional and may not install in restricted environments. Install it (and run `playwright install`) on a machine with network access if you want to run the helper locally.

## Development notes
- Assets and shaders are loaded relative to the repository root; serving over HTTP avoids CORS and local file access issues.
- The engine JavaScript is split between `js/core` (scene and renderer plumbing) and `js/math` utilities; third-party helpers live in `js/3party`.
- Sample models (Sponza, spheres, planes, cube world) reside under `Sec3Engine/models/` and are referenced by the demo HTML pages.

## Troubleshooting
- Use a modern browser with WebGL enabled; if assets fail to load, confirm you’re serving over HTTP rather than `file://`.
- For Playwright captures, ensure the server is running and the forwarded port matches the URL passed to the script.
