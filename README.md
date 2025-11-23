# SEC3ENGINE Playwright Access

This repository contains static web demos under the project root and within the `Sec3Engine/` folder. To visually verify changes from within this environment, you can serve the files locally and capture screenshots with Playwright.

## 1. Serve the project locally
From the repository root, start a simple HTTP server on port 8000:

```bash
python -m http.server 8000
```

- The root `index.html` and `particleDemo.html` will be available at `http://localhost:8000/`.
- The Sec3Engine assets can be accessed under `http://localhost:8000/Sec3Engine/` (for example, `http://localhost:8000/Sec3Engine/index.html`).

Keep this server running in its own terminal while you capture screenshots.

## 2. Capture a screenshot with Playwright
Use the provided helper script to open a page and grab a screenshot. The script is designed to work with the built-in Playwright environment available through the `browser_container` tool, but it can also run anywhere Playwright is installed.

```bash
python scripts/playwright_capture.py --url http://localhost:8000/index.html --out artifacts/home.png --wait 1500
```

- `--url` is the page to open.
- `--out` is where the screenshot is saved (directories will be created if they do not exist).
- `--wait` adds an optional delay (in milliseconds) after navigation to let assets finish loading (defaults to `0`).

When running inside this workspace, you can call the `browser_container.run_playwright_script` helper with the same script to render the live server and return the screenshot artifact.

## 3. Troubleshooting
- If you change the server port, pass the matching URL to `--url`.
- The Playwright script launches Chromium headless by default with container-friendly flags (`--no-sandbox` and `--disable-dev-shm-usage`). If you need a different viewport, use `--width` and `--height`.
- For local (non-workspace) usage, ensure the `playwright` Python package and browsers are installed:

  ```bash
  pip install playwright
  playwright install
  ```
