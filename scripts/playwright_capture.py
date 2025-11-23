import argparse
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright


def parse_args():
    parser = argparse.ArgumentParser(description="Capture a screenshot of a URL using Playwright")
    parser.add_argument("--url", default="http://localhost:8000/index.html", help="Page URL to capture")
    parser.add_argument("--out", default="artifacts/screenshot.png", help="Path to save the screenshot")
    parser.add_argument("--wait", type=int, default=0, help="Delay in milliseconds after navigation")
    parser.add_argument("--width", type=int, default=1280, help="Viewport width")
    parser.add_argument("--height", type=int, default=720, help="Viewport height")
    return parser.parse_args()


async def capture(url: str, out_path: Path, wait_ms: int, width: int, height: int) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(viewport={"width": width, "height": height})
        page = await context.new_page()

        try:
            await page.goto(url)

            if wait_ms > 0:
                await page.wait_for_timeout(wait_ms)

            await page.screenshot(path=str(out_path), full_page=True)
        finally:
            await context.close()
            await browser.close()


async def main():
    args = parse_args()
    await capture(args.url, Path(args.out), args.wait, args.width, args.height)


if __name__ == "__main__":
    asyncio.run(main())
