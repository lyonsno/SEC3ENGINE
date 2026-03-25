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

    def test_index_scene_textures_become_ready_in_browser_runtime(self):
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

        function installTextureProbe() {
          var win = frame.contentWindow;
          if (!win || !win.SEC3 || !win.demo || !Array.isArray(win.model_texcoordVBOs)) {
            return false;
          }
          if (win.__textureHarnessInstalled) {
            return true;
          }

          win.__textureHarnessInstalled = true;
          var attempts = 0;
          var timer = setInterval(function() {
            attempts += 1;
            if (win.SEC3 && win.SEC3.setup && Array.isArray(win.model_texcoordVBOs)) {
              var texturedMeshes = 0;
              var readyTextures = 0;
              var pendingTextures = 0;

              for (var i = 0; i < win.model_texcoordVBOs.length; i += 1) {
                var vbo = win.model_texcoordVBOs[i];
                if (vbo && vbo.texture) {
                  texturedMeshes += 1;
                  if (vbo.texture.ready === true) {
                    readyTextures += 1;
                  }
                  else {
                    pendingTextures += 1;
                  }
                }
              }

              if (texturedMeshes > 0 && readyTextures === texturedMeshes) {
                clearInterval(timer);
                setStatus(
                  "TEXTURED_MESHES=" + texturedMeshes +
                  ";READY_TEXTURES=" + readyTextures +
                  ";PENDING_TEXTURES=" + pendingTextures
                );
                return;
              }

              if (attempts > 360) {
                clearInterval(timer);
                setStatus(
                  "TEXTURED_MESHES=" + texturedMeshes +
                  ";READY_TEXTURES=" + readyTextures +
                  ";PENDING_TEXTURES=" + pendingTextures
                );
              }
              return;
            }

            if (attempts > 360) {
              clearInterval(timer);
              setStatus("HARNESS_TIMEOUT");
            }
          }, 25);

          return true;
        }

        frame.addEventListener("load", function() {
          var attempts = 0;
          var intervalId = setInterval(function() {
            attempts += 1;
            if (installTextureProbe()) {
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
                        "--virtual-time-budget=9000",
                        "--dump-dom",
                        f"{base_url}/{harness_path.name}",
                    ],
                    cwd=REPO_ROOT,
                    capture_output=True,
                    text=True,
                    timeout=40,
                )
        finally:
            harness_path.unlink(missing_ok=True)

        self.assertEqual(
            completed.returncode,
            0,
            f"Headless Chrome SEC3 texture-readiness probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )
        status_match = re.search(r'<pre id="status">([^<]+)</pre>', completed.stdout)
        self.assertIsNotNone(
            status_match,
            f"SEC3 texture-readiness harness should report a status line in the dumped DOM:\n{completed.stdout}",
        )
        status_line = status_match.group(1)
        self.assertNotEqual(
            status_line,
            "HARNESS_TIMEOUT",
            (
                "SEC3 texture-readiness harness timed out before the demo exposed scene texture state; "
                f"status line was: {status_line}\nDOM dump was:\n{completed.stdout}"
            ),
        )
        self.assertFalse(
            status_line.startswith("HARNESS_ERROR:"),
            f"SEC3 texture-readiness harness script reported an error: {status_line}\nDOM dump:\n{completed.stdout}",
        )

        texture_status_match = re.search(
            r"TEXTURED_MESHES=(-?\d+);READY_TEXTURES=(-?\d+);PENDING_TEXTURES=(-?\d+)",
            status_line,
        )
        self.assertIsNotNone(
            texture_status_match,
            (
                "SEC3 texture-readiness harness should report how many textured meshes and ready textures the real "
                f"browser runtime observed; status line was: {status_line}\nDOM dump was:\n{completed.stdout}"
            ),
        )

        textured_meshes = int(texture_status_match.group(1))
        ready_textures = int(texture_status_match.group(2))
        pending_textures = int(texture_status_match.group(3))
        self.assertGreater(
            textured_meshes,
            0,
            (
                "The SEC3 index demo should attach at least one texture-backed mesh once the Sponza scene loads; "
                f"observed status: {status_line}"
            ),
        )
        self.assertGreater(
            ready_textures,
            0,
            (
                "The SEC3 index demo should finish uploading at least one scene texture in the browser runtime; "
                f"observed status: {status_line}"
            ),
        )
        self.assertEqual(
            ready_textures,
            textured_meshes,
            (
                "Once the SEC3 index demo reports textured meshes, all of those mesh textures should finish uploading "
                f"before the browser smoke probe settles; observed status: {status_line}"
            ),
        )
        self.assertEqual(
            pending_textures,
            0,
            (
                "The SEC3 index demo should not leave any scene textures pending by the time the browser readiness probe "
                f"settles; observed status: {status_line}"
            ),
        )

    def test_index_fetches_scene_texture_assets_and_renders_textured_detail(self):
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

        function captureRegion(gl, x, y, width, height) {
          var pixels = new Uint8Array(width * height * 4);
          gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          return pixels;
        }

        function countTexturedPixels(pixels) {
          if (!pixels || pixels.length === 0) {
            return 0;
          }
          var detailed = 0;
          for (var i = 0; i < pixels.length; i += 4) {
            var channelSpread = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
            var luminance = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
            if (luminance > 18 && channelSpread > 8) {
              detailed += 1;
            }
          }
          return detailed;
        }

        function installTextureDetailProbe() {
          var win = frame.contentWindow;
          if (!win || !win.SEC3 || !win.demo || typeof win.myRender !== "function") {
            return false;
          }
          if (win.__textureDetailHarnessInstalled) {
            return true;
          }

          win.__textureDetailHarnessInstalled = true;
          var attempts = 0;
          var timer = setInterval(function() {
            attempts += 1;
            if (win.SEC3 && win.SEC3.setup && win.gl && win.SEC3.canvas && Array.isArray(win.model_texcoordVBOs)) {
              var texturedMeshes = 0;
              var readyTextures = 0;
              for (var i = 0; i < win.model_texcoordVBOs.length; i += 1) {
                var vbo = win.model_texcoordVBOs[i];
                if (vbo && vbo.texture) {
                  texturedMeshes += 1;
                  if (vbo.texture.ready === true) {
                    readyTextures += 1;
                  }
                }
              }

              if (texturedMeshes > 0 && readyTextures === texturedMeshes) {
                if (win.particleSystem && typeof win.particleSystem.stepParticles === "function") {
                  win.particleSystem.stepParticles = function() {};
                }
                if (typeof win.moveLight === "function") {
                  win.moveLight = function() {};
                }
              win.demo.secondPass = "bufferRenderProg";
              win.myRender();

              var canvas = win.SEC3.canvas;
                var sampleWidth = Math.max(8, Math.floor(canvas.width * 0.36));
                var sampleHeight = Math.max(8, Math.floor(canvas.height * 0.32));
                var sampleX = Math.floor(canvas.width * 0.32);
                var sampleY = Math.floor(canvas.height * 0.36);
                var pixels = captureRegion(win.gl, sampleX, sampleY, sampleWidth, sampleHeight);
                var texturedPixels = countTexturedPixels(pixels);

                clearInterval(timer);
                setStatus(
                  "TEXTURED_MESHES=" + texturedMeshes +
                  ";READY_TEXTURES=" + readyTextures +
                  ";TEXTURED_PIXELS=" + texturedPixels +
                  ";SAMPLE_PIXELS=" + (sampleWidth * sampleHeight)
                );
                return;
              }
            }

            if (attempts > 360) {
              clearInterval(timer);
              setStatus("HARNESS_TIMEOUT");
            }
          }, 25);

          return true;
        }

        frame.addEventListener("load", function() {
          var attempts = 0;
          var intervalId = setInterval(function() {
            attempts += 1;
            if (installTextureDetailProbe()) {
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
                        "--virtual-time-budget=9000",
                        "--dump-dom",
                        f"{base_url}/{harness_path.name}",
                    ],
                    cwd=REPO_ROOT,
                    capture_output=True,
                    text=True,
                    timeout=25,
                )
        finally:
            harness_path.unlink(missing_ok=True)

        self.assertEqual(
            completed.returncode,
            0,
            f"Headless Chrome SEC3 texture-detail probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )
        status_match = re.search(r'<pre id="status">([^<]+)</pre>', completed.stdout)
        self.assertIsNotNone(
            status_match,
            f"SEC3 texture-detail harness should report a status line in the dumped DOM:\n{completed.stdout}",
        )
        status_line = status_match.group(1)
        self.assertNotEqual(
            status_line,
            "HARNESS_TIMEOUT",
            (
                "SEC3 texture-detail harness timed out before the demo settled into a fully textured render; "
                f"status line was: {status_line}\nDOM dump was:\n{completed.stdout}"
            ),
        )
        self.assertFalse(
            status_line.startswith("HARNESS_ERROR:"),
            f"SEC3 texture-detail harness script reported an error: {status_line}\nDOM dump:\n{completed.stdout}",
        )

        status_fields = re.search(
            r"TEXTURED_MESHES=(-?\d+);READY_TEXTURES=(-?\d+);TEXTURED_PIXELS=(-?\d+);SAMPLE_PIXELS=(-?\d+)",
            status_line,
        )
        self.assertIsNotNone(
            status_fields,
            (
                "SEC3 texture-detail harness should report texture readiness and sampled scene detail; "
                f"observed status: {status_line}\nDOM dump was:\n{completed.stdout}"
            ),
        )

        textured_meshes = int(status_fields.group(1))
        ready_textures = int(status_fields.group(2))
        textured_pixels = int(status_fields.group(3))
        sample_pixels = int(status_fields.group(4))

        self.assertGreater(
            textured_meshes,
            0,
            f"The SEC3 index demo should expose textured meshes in the browser runtime; observed status: {status_line}",
        )
        self.assertEqual(
            ready_textures,
            textured_meshes,
            f"All textured SEC3 meshes should have ready textures before detail sampling; observed status: {status_line}",
        )
        self.assertGreater(
            sample_pixels,
            0,
            "The SEC3 texture-detail browser probe should sample a valid scene region",
        )
        self.assertGreater(
            textured_pixels,
            2000,
            (
                "Once scene textures are fetched and ready, the sampled index-demo render region should contain enough "
                f"color/detail variation to plausibly reflect textured surfaces; observed status: {status_line}"
            ),
        )

    def test_index_near_dof_controls_change_foreground_pixels_in_close_camera_view(self):
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

        function captureRegion(gl, x, y, width, height) {
          var pixels = new Uint8Array(width * height * 4);
          gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          return pixels;
        }

        function countPixelDelta(lhs, rhs) {
          if (!lhs || !rhs || lhs.length !== rhs.length) {
            return -1;
          }
          var changed = 0;
          for (var i = 0; i < lhs.length; i += 4) {
            var delta =
              Math.abs(lhs[i] - rhs[i]) +
              Math.abs(lhs[i + 1] - rhs[i + 1]) +
              Math.abs(lhs[i + 2] - rhs[i + 2]);
            if (delta >= 12) {
              changed += 1;
            }
          }
          return changed;
        }

        function findSliderByLabelSuffix(win, suffix) {
          var container = win.document && win.document.getElementById("uiWrapper");
          if (!container) {
            return null;
          }
          var labels = container.getElementsByTagName("label");
          for (var i = 0; i < labels.length; i += 1) {
            var label = labels[i];
            if (label && typeof label.innerText === "string" && label.innerText.indexOf(suffix) !== -1) {
              return label.previousSibling;
            }
          }
          return null;
        }

        function installNearDofProbe() {
          var win = frame.contentWindow;
          if (!win || !win.SEC3 || !win.SEC3.postFx || !win.demo || !win.camera || typeof win.myRender !== "function") {
            return false;
          }
          if (win.__nearDofHarnessInstalled) {
            return true;
          }

          win.__nearDofHarnessInstalled = true;
          var attempts = 0;
          var timer = setInterval(function() {
            attempts += 1;
            if (win.SEC3 && win.SEC3.setup && win.gl && win.SEC3.canvas) {
              clearInterval(timer);

              if (win.particleSystem && typeof win.particleSystem.stepParticles === "function") {
                win.particleSystem.stepParticles = function() {};
              }
              if (typeof win.moveLight === "function") {
                win.moveLight = function() {};
              }

              if (win.camera.goHome) {
                win.camera.goHome([-0.5, 2.0, 1.0]);
              }
              if (win.camera.setAzimuth) {
                win.camera.setAzimuth(88.0);
              }
              if (win.camera.setElevation) {
                win.camera.setElevation(-5.0);
              }

              var gl = win.gl;
              var canvas = win.SEC3.canvas;
              var foregroundWidth = Math.max(8, Math.floor(canvas.width * 0.22));
              var foregroundHeight = Math.max(8, Math.floor(canvas.height * 0.28));
              var foregroundX = Math.floor(canvas.width * 0.40);
              var foregroundY = Math.floor(canvas.height * 0.35);
              var backgroundX = Math.floor(canvas.width * 0.68);
              var backgroundY = Math.floor(canvas.height * 0.45);
              var beforeSlope = win.demo.nearSlope;
              var beforeIntercept = win.demo.nearIntercept;

              var slopeSlider = findSliderByLabelSuffix(win, ":Near slope");
              var interceptSlider = findSliderByLabelSuffix(win, ":Near intercept");
              if (!slopeSlider || !interceptSlider) {
                setStatus("HARNESS_ERROR:missing-near-dof-sliders");
                return;
              }
              slopeSlider.value = -10.0;
              slopeSlider.dispatchEvent(new win.Event("input", { bubbles: true }));
              interceptSlider.value = 3.0;
              interceptSlider.dispatchEvent(new win.Event("input", { bubbles: true }));
              var afterSlope = win.demo.nearSlope;
              var afterIntercept = win.demo.nearIntercept;

              // Isolate near-DOF so the probe measures the close-focus path rather than far blur.
              win.demo.farSlope = 0.0;
              win.demo.farIntercept = 0.0;

              win.demo.secondPass = "bufferRenderProg";
              win.myRender();
              var beforeForeground = captureRegion(gl, foregroundX, foregroundY, foregroundWidth, foregroundHeight);
              var beforeBackground = captureRegion(gl, backgroundX, backgroundY, foregroundWidth, foregroundHeight);

              win.demo.secondPass = "dofProg";
              win.myRender();
              var afterForeground = captureRegion(gl, foregroundX, foregroundY, foregroundWidth, foregroundHeight);
              var afterBackground = captureRegion(gl, backgroundX, backgroundY, foregroundWidth, foregroundHeight);
              var foregroundDelta = countPixelDelta(beforeForeground, afterForeground);
              var backgroundDelta = countPixelDelta(beforeBackground, afterBackground);

              setStatus(
                "BEFORE_NEAR_SLOPE=" + beforeSlope +
                ";AFTER_NEAR_SLOPE=" + afterSlope +
                ";BEFORE_NEAR_INTERCEPT=" + beforeIntercept +
                ";AFTER_NEAR_INTERCEPT=" + afterIntercept +
                ";" +
                "FOREGROUND_DELTA=" + foregroundDelta +
                ";BACKGROUND_DELTA=" + backgroundDelta +
                ";SAMPLE_PIXELS=" + (foregroundWidth * foregroundHeight)
              );
              return;
            }
            if (attempts > 320) {
              clearInterval(timer);
              setStatus("MODE_SWITCH_TIMEOUT");
            }
          }, 25);

          return true;
        }

        frame.addEventListener("load", function() {
          var attempts = 0;
          var intervalId = setInterval(function() {
            attempts += 1;
            if (installNearDofProbe()) {
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
                        "--virtual-time-budget=9000",
                        "--dump-dom",
                        f"{base_url}/{harness_path.name}",
                    ],
                    cwd=REPO_ROOT,
                    capture_output=True,
                    text=True,
                    timeout=25,
                )
        finally:
            harness_path.unlink(missing_ok=True)

        self.assertEqual(
            completed.returncode,
            0,
            f"Headless Chrome SEC3 near-DOF probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )
        status_match = re.search(r'<pre id="status">([^<]+)</pre>', completed.stdout)
        self.assertIsNotNone(
            status_match,
            f"SEC3 near-DOF harness should report a status line in the dumped DOM:\n{completed.stdout}",
        )
        status_line = status_match.group(1)
        self.assertNotEqual(
            status_line,
            "HARNESS_TIMEOUT",
            (
                "SEC3 near-DOF harness timed out before the demo exposed post-processing callbacks; "
                f"status line was: {status_line}\nDOM dump was:\n{completed.stdout}"
            ),
        )
        self.assertNotEqual(
            status_line,
            "MODE_SWITCH_TIMEOUT",
            (
                "SEC3 near-DOF harness timed out while waiting for SEC3.setup/GL state; "
                f"status line was: {status_line}\nDOM dump was:\n{completed.stdout}"
            ),
        )
        self.assertFalse(
            status_line.startswith("HARNESS_ERROR:"),
            f"SEC3 near-DOF harness script reported an error: {status_line}\nDOM dump:\n{completed.stdout}",
        )

        near_status_match = re.search(
            r"BEFORE_NEAR_SLOPE=([^;]+);AFTER_NEAR_SLOPE=([^;]+);BEFORE_NEAR_INTERCEPT=([^;]+);AFTER_NEAR_INTERCEPT=([^;]+);FOREGROUND_DELTA=(-?\d+);BACKGROUND_DELTA=(-?\d+);SAMPLE_PIXELS=(-?\d+)",
            status_line,
        )
        self.assertIsNotNone(
            near_status_match,
            (
                "SEC3 near-DOF harness should report foreground and background deltas after configuring a close-focus "
                f"preset through the near-focus controls; observed status: {status_line}\nDOM dump was:\n{completed.stdout}"
            ),
        )

        before_slope = float(near_status_match.group(1))
        after_slope = float(near_status_match.group(2))
        before_intercept = float(near_status_match.group(3))
        after_intercept = float(near_status_match.group(4))
        foreground_delta = int(near_status_match.group(5))
        background_delta = int(near_status_match.group(6))
        sample_pixels = int(near_status_match.group(7))
        self.assertNotEqual(
            before_slope,
            after_slope,
            (
                "The near-slope slider callback should update demo.nearSlope in the live browser runtime before the "
                f"near-DOF probe samples pixels; observed status: {status_line}"
            ),
        )
        self.assertNotEqual(
            before_intercept,
            after_intercept,
            (
                "The near-intercept slider callback should update demo.nearIntercept in the live browser runtime "
                f"before the near-DOF probe samples pixels; observed status: {status_line}"
            ),
        )
        self.assertGreater(
            sample_pixels,
            0,
            "SEC3 near-DOF browser probe should sample a valid foreground region for frame-delta checks",
        )
        self.assertGreater(
            foreground_delta,
            20,
            (
                "Configuring a strong near-focus preset in a close camera view should make the DOF pass visibly change "
                f"at least part of the foreground sample relative to the buffer-render pass; observed status: {status_line}"
            ),
        )
        self.assertGreater(
            foreground_delta,
            background_delta,
            (
                "Near-DOF tuning should affect the foreground-focused sample more than the background sample; "
                f"observed status: {status_line}"
            ),
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
