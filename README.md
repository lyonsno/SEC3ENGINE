# SEC3ENGINE

A collection of WebGL demos and a lightweight engine prototype for rendering experiments. The repository contains the core engine under `Sec3Engine/`, a few HTML entry points, and an older "NoEngines" demo for comparison.

## Project layout
- **`index.html`**: Loads the Sec3Engine core and runs the `SEC3DEMO` scene (water/particle-style rendering) inside a canvas.
- **`particleDemo.html`**: Alternate entry that exercises the particle system.
- **`Sec3Engine/`**: Engine sources (`js/core`, `js/math`, `js/3party`), shaders, and an additional `sec3index.html` demo page.
- **`NoEngines/`**: Legacy demo without the engine abstraction. Open `NoEngines/index.html` to compare behaviors.

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
You can automate visual checks using the included helper script. It works both locally (with Playwright installed) and inside this workspace via the built-in `browser_container` runtime.

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

## Troubleshooting
- Use a modern browser with WebGL enabled; if assets fail to load, confirm you’re serving over HTTP rather than `file://`.
- For Playwright captures, ensure the server is running and the forwarded port matches the URL passed to the script.
