import functools
import http.server
import os
import shutil
import socket
import subprocess
import tempfile
import threading
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def find_chrome_binary():
    env_override = os.environ.get("SEC3ENGINE_CHROME_BIN")
    if env_override:
        return Path(env_override)
    if DEFAULT_CHROME.exists():
        return DEFAULT_CHROME
    discovered = (
        shutil.which("google-chrome")
        or shutil.which("google-chrome-stable")
        or shutil.which("chromium")
        or shutil.which("chromium-browser")
        or shutil.which("chrome")
    )
    return Path(discovered) if discovered else None


def can_bind_localhost():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", 0))
    except OSError:
        return False
    finally:
        sock.close()
    return True


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    requests = []
    response_log = []

    def do_GET(self):
        self.__class__.requests.append(self.path)
        super().do_GET()

    def send_response(self, code, message=None):
        self.__class__.response_log.append((self.path, code))
        super().send_response(code, message)

    def log_message(self, format, *args):
        pass


class LocalHTTPServer:
    def __init__(self, directory: Path):
        self.directory = directory
        self.httpd = None
        self.thread = None
        self.base_url = None

    def __enter__(self):
        handler = functools.partial(QuietHandler, directory=str(self.directory))
        try:
            self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        except OSError as exc:
            raise unittest.SkipTest(f"Loopback HTTP server unavailable for browser smoke tests: {exc}") from exc
        port = self.httpd.server_address[1]
        self.base_url = f"http://127.0.0.1:{port}"
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        return self.base_url

    def __exit__(self, exc_type, exc, tb):
        if self.httpd is not None:
            self.httpd.shutdown()
            self.httpd.server_close()
        if self.thread is not None:
            self.thread.join(timeout=2)


@unittest.skipUnless(find_chrome_binary() is not None, "Google Chrome or Chromium is required for browser smoke tests")
@unittest.skipUnless(can_bind_localhost(), "Loopback HTTP server access is required for browser smoke tests")
class ParticleDemoBrowserSmokeTests(unittest.TestCase):
    def test_particle_demo_does_not_report_framebuffer_errors_during_boot(self):
        chrome = str(find_chrome_binary())
        completed = None
        screenshot_created = False
        QuietHandler.requests = []
        QuietHandler.response_log = []
        with tempfile.TemporaryDirectory(prefix="sec3engine-particle-smoke-") as temp_dir:
            screenshot_path = Path(temp_dir) / "particle-demo.png"
            with LocalHTTPServer(REPO_ROOT) as base_url:
                completed = subprocess.run(
                    [
                        chrome,
                        "--headless=new",
                        "--disable-gpu",
                        "--enable-logging=stderr",
                        "--enable-webgl",
                        "--ignore-gpu-blocklist",
                        "--use-gl=angle",
                        "--use-angle=swiftshader",
                        "--enable-unsafe-swiftshader",
                        "--virtual-time-budget=5000",
                        "--window-size=1280,900",
                        f"--screenshot={screenshot_path}",
                        f"{base_url}/particleDemo.html",
                    ],
                    cwd=REPO_ROOT,
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                screenshot_created = screenshot_path.exists()

        self.assertEqual(
            completed.returncode,
            0,
            f"Headless Chrome particle-demo smoke test failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )
        self.assertTrue(screenshot_created, "Headless Chrome should produce a particle-demo screenshot")
        spark_texture_requests = [
            request_path for request_path in QuietHandler.requests if request_path.startswith("/Sec3Engine/textures/spark.png")
        ]
        self.assertTrue(
            spark_texture_requests,
            "particleDemo.html should boot far enough to request its particle texture over HTTP",
        )
        self.assertTrue(
            any(
                response_path.startswith("/Sec3Engine/textures/spark.png") and response_code == 200
                for response_path, response_code in QuietHandler.response_log
            ),
            "particleDemo.html should receive a successful HTTP response for its particle texture",
        )
        self.assertNotIn(
            "GL_INVALID_FRAMEBUFFER_OPERATION",
            completed.stderr,
            "particleDemo.html should not report framebuffer completeness errors during boot",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
