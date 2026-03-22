import functools
import http.server
import os
import re
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


def write_sec3demo_harness_file(directory: Path, harness_source: str):
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=directory,
        prefix="__sec3demo_dof_harness__",
        suffix=".html",
        delete=False,
    ) as harness_file:
        harness_file.write(harness_source)
        return Path(harness_file.name)


class Sec3DemoHarnessFileTests(unittest.TestCase):
    def test_harness_file_creation_uses_unique_path_and_preserves_existing_fixed_name_file(self):
        with tempfile.TemporaryDirectory(prefix="sec3engine-sec3demo-harness-") as temp_dir:
            temp_dir_path = Path(temp_dir)
            fixed_name_path = temp_dir_path / "__sec3demo_dof_harness__.html"
            fixed_name_path.write_text("do-not-touch", encoding="utf-8")

            harness_path = write_sec3demo_harness_file(temp_dir_path, "<html><body>probe</body></html>")
            try:
                self.assertNotEqual(
                    harness_path,
                    fixed_name_path,
                    "SEC3 browser smoke harness should use a unique temp filename instead of a fixed top-level name",
                )
                self.assertEqual(
                    fixed_name_path.read_text(encoding="utf-8"),
                    "do-not-touch",
                    "Creating a harness file should not overwrite a pre-existing fixed-name harness file",
                )
            finally:
                harness_path.unlink(missing_ok=True)

            self.assertTrue(
                fixed_name_path.exists(),
                "Removing the generated harness should not remove unrelated pre-existing fixed-name files",
            )


@unittest.skipUnless(find_chrome_binary() is not None, "Google Chrome or Chromium is required for browser smoke tests")
@unittest.skipUnless(can_bind_localhost(), "Loopback HTTP server access is required for browser smoke tests")
class Sec3DemoBrowserSmokeTests(unittest.TestCase):
    def test_index_dof_keypath_invokes_browser_dof_pass(self):
        harness_source = """<!doctype html>
<html>
  <body>
    <iframe id="demo" src="/index.html" style="width:1280px;height:900px;border:0;"></iframe>
    <pre id="status">BOOTING</pre>
    <script>
      (function() {
        var statusNode = document.getElementById("status");
        var frame = document.getElementById("demo");

        function setStatus(text) {
          statusNode.textContent = text;
        }

        window.onerror = function(message) {
          setStatus("HARNESS_ERROR:" + message);
        };

        function installDofProbe() {
          var win = frame.contentWindow;
          if (!win || !win.SEC3 || !win.SEC3.postFx || !win.demo || typeof win.SEC3.postFx.dofPass !== "function") {
            return false;
          }
          if (win.__dofHarnessInstalled) {
            return true;
          }

          win.__dofHarnessInstalled = true;
          win.__dofCalls = 0;

          var originalDofPass = win.SEC3.postFx.dofPass;
          win.SEC3.postFx.dofPass = function() {
            win.__dofCalls += 1;
            return originalDofPass.apply(this, arguments);
          };

          function captureCenterPixels() {
            var canvas = win.SEC3 && win.SEC3.canvas;
            var gl = win.gl;
            if (!canvas || !gl) {
              return null;
            }
            var width = canvas.width;
            var height = canvas.height;
            var sampleWidth = Math.max(1, Math.floor(width * 0.5));
            var sampleHeight = Math.max(1, Math.floor(height * 0.5));
            var left = Math.floor((width - sampleWidth) / 2);
            var top = Math.floor((height - sampleHeight) / 2);
            var pixels = new Uint8Array(sampleWidth * sampleHeight * 4);
            gl.readPixels(left, top, sampleWidth, sampleHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            return {
              pixels: pixels,
              samplePixels: sampleWidth * sampleHeight
            };
          }

          function countPixelDelta(lhs, rhs) {
            if (!lhs || !rhs || lhs.pixels.length !== rhs.pixels.length) {
              return -1;
            }
            var changed = 0;
            for (var i = 0; i < lhs.pixels.length; i += 4) {
              var delta =
                Math.abs(lhs.pixels[i] - rhs.pixels[i]) +
                Math.abs(lhs.pixels[i + 1] - rhs.pixels[i + 1]) +
                Math.abs(lhs.pixels[i + 2] - rhs.pixels[i + 2]);
              if (delta >= 24) {
                changed += 1;
              }
            }
            return changed;
          }

          var modeSwitchAttempts = 0;
          var modeSwitchTimer = setInterval(function() {
            modeSwitchAttempts += 1;
            if (win.SEC3 && win.SEC3.setup && typeof win.onkeydown === "function") {
              clearInterval(modeSwitchTimer);
              if (win.particleSystem && typeof win.particleSystem.stepParticles === "function") {
                win.particleSystem.stepParticles = function() {};
              }
              if (typeof win.moveLight === "function") {
                win.moveLight = function() {};
              }
              win.demo.secondPass = "bufferRenderProg";
              if (typeof win.myRender === "function") {
                win.myRender();
              }
              var bufferSample = captureCenterPixels();
              win.onkeydown({
                keyCode: 55,
                which: 55,
                preventDefault: function() {},
                stopPropagation: function() {}
              });
              win.demo.secondPass = "dofProg";
              if (typeof win.myRender === "function") {
                win.myRender();
              }
              var dofSample = captureCenterPixels();
              var pixelDelta = countPixelDelta(bufferSample, dofSample);
              var samplePixels = dofSample ? dofSample.samplePixels : -1;
              setTimeout(function() {
                setStatus(
                  "DOF_CALLS=" + win.__dofCalls +
                  ";SECOND_PASS=" + win.demo.secondPass +
                  ";WAITING=" + win.SEC3.isWaiting +
                  ";PIXEL_DELTA=" + pixelDelta +
                  ";SAMPLE_PIXELS=" + samplePixels
                );
              }, 600);
              return;
            }
            if (modeSwitchAttempts > 160) {
              clearInterval(modeSwitchTimer);
              setStatus("MODE_SWITCH_TIMEOUT");
            }
          }, 25);
          return true;
        }

        frame.addEventListener("load", function() {
          var attempts = 0;
          var intervalId = setInterval(function() {
            attempts += 1;
            if (installDofProbe()) {
              clearInterval(intervalId);
              return;
            }
            if (attempts > 320) {
              clearInterval(intervalId);
              setStatus("HARNESS_TIMEOUT");
            }
          }, 25);
        });
      })();
    </script>
  </body>
</html>
"""
        harness_path = write_sec3demo_harness_file(REPO_ROOT, harness_source)
        try:
            with LocalHTTPServer(REPO_ROOT) as base_url:
                completed = subprocess.run(
                    [
                        str(find_chrome_binary()),
                        "--headless=new",
                        "--disable-gpu",
                        "--enable-logging=stderr",
                        "--enable-webgl",
                        "--ignore-gpu-blocklist",
                        "--use-gl=angle",
                        "--use-angle=swiftshader",
                        "--enable-unsafe-swiftshader",
                        "--virtual-time-budget=7000",
                        "--dump-dom",
                        f"{base_url}/{harness_path.name}",
                    ],
                    cwd=REPO_ROOT,
                    capture_output=True,
                    text=True,
                    timeout=20,
                )
        finally:
            harness_path.unlink(missing_ok=True)

        self.assertEqual(
            completed.returncode,
            0,
            f"Headless Chrome SEC3 demo DOF probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )
        status_match = re.search(r'<pre id="status">([^<]+)</pre>', completed.stdout)
        self.assertIsNotNone(
            status_match,
            f"SEC3 DOF harness should report a status line in the dumped DOM:\n{completed.stdout}",
        )
        status_line = status_match.group(1)
        self.assertNotEqual(
            status_line,
            "HARNESS_TIMEOUT",
            (
                "SEC3 DOF harness timed out before the demo exposed post-processing callbacks; "
                f"status line was: {status_line}\nDOM dump was:\n{completed.stdout}"
            ),
        )
        self.assertNotEqual(
            status_line,
            "MODE_SWITCH_TIMEOUT",
            (
                "SEC3 DOF harness timed out while waiting for SEC3.setup/keydown wiring; "
                f"status line was: {status_line}\nDOM dump was:\n{completed.stdout}"
            ),
        )
        self.assertFalse(
            status_line.startswith("HARNESS_ERROR:"),
            f"SEC3 DOF harness script reported an error: {status_line}\nDOM dump:\n{completed.stdout}",
        )

        dof_status_match = re.search(
            r"DOF_CALLS=(\d+);SECOND_PASS=([^;]+);WAITING=([A-Za-z]+);PIXEL_DELTA=(-?\d+);SAMPLE_PIXELS=(-?\d+)",
            status_line,
        )
        self.assertIsNotNone(
            dof_status_match,
            (
                "SEC3 DOF harness should report observed DOF/pass state after mode switch; "
                f"status line was: {status_line}\nDOM dump was:\n{completed.stdout}"
            ),
        )

        dof_calls = int(dof_status_match.group(1))
        second_pass = dof_status_match.group(2)
        pixel_delta = int(dof_status_match.group(4))
        sample_pixels = int(dof_status_match.group(5))
        self.assertEqual(
            second_pass,
            "dofProg",
            "Pressing key '7' in the browser harness should switch SEC3 demo second pass to dofProg",
        )
        self.assertGreater(
            dof_calls,
            0,
            "After selecting dofProg, the SEC3 browser runtime should execute postFx.dofPass during rendering",
        )
        self.assertGreater(
            sample_pixels,
            0,
            "SEC3 DOF browser probe should sample a valid canvas region for frame-delta checks",
        )
        self.assertGreater(
            pixel_delta,
            500,
            (
                "Switching from bufferRenderProg to dofProg should produce a meaningful rendered-frame delta in the "
                f"sampled canvas region; observed status: {status_line}"
            ),
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
