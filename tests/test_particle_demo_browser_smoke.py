import functools
import http.server
import os
import shutil
import socket
import struct
import subprocess
import tempfile
import threading
import unittest
import zlib
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
PARTICLE_DEMO_CLEAR_RGB = (51, 51, 51)
PARTICLE_DEMO_CANVAS_BOUNDS = (8, 8, 508, 508)


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


def decode_png(png_bytes):
    assert png_bytes[:8] == b"\x89PNG\r\n\x1a\n"
    cursor = 8
    width = None
    height = None
    bit_depth = None
    color_type = None
    idat_chunks = bytearray()

    while cursor < len(png_bytes):
        chunk_length = struct.unpack(">I", png_bytes[cursor : cursor + 4])[0]
        chunk_type = png_bytes[cursor + 4 : cursor + 8]
        chunk_data = png_bytes[cursor + 8 : cursor + 8 + chunk_length]
        cursor += chunk_length + 12

        if chunk_type == b"IHDR":
            width, height, bit_depth, color_type, compression, filter_method, interlace = struct.unpack(
                ">IIBBBBB", chunk_data
            )
            assert compression == 0
            assert filter_method == 0
            assert interlace == 0
        elif chunk_type == b"IDAT":
            idat_chunks.extend(chunk_data)
        elif chunk_type == b"IEND":
            break

    assert width is not None and height is not None
    assert bit_depth == 8
    channels = {2: 3, 6: 4}.get(color_type)
    assert channels is not None, f"Expected RGB or RGBA PNG screenshot, got color type {color_type}"

    stride = width * channels
    raw_scanlines = zlib.decompress(bytes(idat_chunks))
    decoded_rows = []
    cursor = 0
    previous_row = bytearray(stride)

    for _ in range(height):
        filter_type = raw_scanlines[cursor]
        cursor += 1
        row = bytearray(raw_scanlines[cursor : cursor + stride])
        cursor += stride

        if filter_type == 1:
            for index in range(channels, stride):
                row[index] = (row[index] + row[index - channels]) & 0xFF
        elif filter_type == 2:
            for index in range(stride):
                row[index] = (row[index] + previous_row[index]) & 0xFF
        elif filter_type == 3:
            for index in range(stride):
                left = row[index - channels] if index >= channels else 0
                up = previous_row[index]
                row[index] = (row[index] + ((left + up) >> 1)) & 0xFF
        elif filter_type == 4:
            for index in range(stride):
                left = row[index - channels] if index >= channels else 0
                up = previous_row[index]
                up_left = previous_row[index - channels] if index >= channels else 0
                predictor = left + up - up_left
                choose_left = abs(predictor - left)
                choose_up = abs(predictor - up)
                choose_up_left = abs(predictor - up_left)
                if choose_left <= choose_up and choose_left <= choose_up_left:
                    paeth = left
                elif choose_up <= choose_up_left:
                    paeth = up
                else:
                    paeth = up_left
                row[index] = (row[index] + paeth) & 0xFF

        decoded_rows.append(bytes(row))
        previous_row = row

    return width, height, channels, decoded_rows


def encode_rgb_png(width, height, rgb_rows):
    def chunk(chunk_type, chunk_data):
        chunk_length = struct.pack(">I", len(chunk_data))
        checksum = zlib.crc32(chunk_type + chunk_data) & 0xFFFFFFFF
        return chunk_length + chunk_type + chunk_data + struct.pack(">I", checksum)

    raw_rows = bytearray()
    for row in rgb_rows:
        raw_rows.append(0)
        raw_rows.extend(row)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw_rows))
    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", ihdr),
            chunk(b"IDAT", idat),
            chunk(b"IEND", b""),
        ]
    )


def is_clear_color(red, green, blue):
    clear_red, clear_green, clear_blue = PARTICLE_DEMO_CLEAR_RGB
    return abs(red - clear_red) + abs(green - clear_green) + abs(blue - clear_blue) <= 12


def detect_particle_demo_canvas_bounds(width, height, channels, rows):
    clear_column_counts = []
    for x in range(width):
        clear_pixels = 0
        for y in range(height):
            offset = x * channels
            red = rows[y][offset]
            green = rows[y][offset + 1]
            blue = rows[y][offset + 2]
            if is_clear_color(red, green, blue):
                clear_pixels += 1
        clear_column_counts.append(clear_pixels)

    clear_row_counts = []
    for y in range(height):
        clear_pixels = 0
        row = rows[y]
        for x in range(width):
            offset = x * channels
            red = row[offset]
            green = row[offset + 1]
            blue = row[offset + 2]
            if is_clear_color(red, green, blue):
                clear_pixels += 1
        clear_row_counts.append(clear_pixels)

    max_column_count = max(clear_column_counts, default=0)
    max_row_count = max(clear_row_counts, default=0)
    if max_column_count < 100 or max_row_count < 100:
        return PARTICLE_DEMO_CANVAS_BOUNDS

    column_threshold = max(100, int(max_column_count * 0.6))
    row_threshold = max(100, int(max_row_count * 0.6))

    qualifying_columns = [index for index, count in enumerate(clear_column_counts) if count >= column_threshold]
    qualifying_rows = [index for index, count in enumerate(clear_row_counts) if count >= row_threshold]
    if not qualifying_columns or not qualifying_rows:
        return PARTICLE_DEMO_CANVAS_BOUNDS

    return (
        qualifying_columns[0],
        qualifying_rows[0],
        qualifying_columns[-1] + 1,
        qualifying_rows[-1] + 1,
    )


def summarize_canvas_region(screenshot_path: Path):
    width, height, channels, rows = decode_png(screenshot_path.read_bytes())
    canvas_left, canvas_top, canvas_right, canvas_bottom = detect_particle_demo_canvas_bounds(
        width, height, channels, rows
    )
    left = max(canvas_left + 16, 0)
    top = max(canvas_top + 16, 0)
    right = min(canvas_right - 16, width)
    bottom = min(canvas_bottom - 16, height)

    non_clear_pixels = 0
    bright_cluster_pixels = 0
    total_pixels = max(1, (right - left) * (bottom - top))
    clear_red, clear_green, clear_blue = PARTICLE_DEMO_CLEAR_RGB
    center_left = left + ((right - left) // 4)
    center_right = right - ((right - left) // 4)
    center_top = top + ((bottom - top) // 4)
    center_bottom = bottom - ((bottom - top) // 4)

    for y in range(top, bottom):
        row = rows[y]
        for x in range(left, right):
            offset = x * channels
            red = row[offset]
            green = row[offset + 1]
            blue = row[offset + 2]
            color_distance = abs(red - clear_red) + abs(green - clear_green) + abs(blue - clear_blue)
            if color_distance >= 24:
                non_clear_pixels += 1
            if (
                center_left <= x < center_right
                and center_top <= y < center_bottom
                and color_distance >= 180
                and max(red, green, blue) >= 180
            ):
                bright_cluster_pixels += 1

    return {
        "width": width,
        "height": height,
        "region": (left, top, right, bottom),
        "center_region": (center_left, center_top, center_right, center_bottom),
        "non_clear_pixels": non_clear_pixels,
        "non_clear_ratio": non_clear_pixels / total_pixels,
        "bright_cluster_pixels": bright_cluster_pixels,
        "bright_cluster_ratio": bright_cluster_pixels / total_pixels,
    }


class ParticleDemoScreenshotAnalysisTests(unittest.TestCase):
    def test_summarize_canvas_region_detects_particle_canvas_when_layout_shifts(self):
        width = 1280
        height = 900
        clear = PARTICLE_DEMO_CLEAR_RGB
        rows = []
        for y in range(height):
            row = bytearray([255, 255, 255] * width)
            for x in range(700, 1200):
                if 100 <= y < 600:
                    offset = x * 3
                    row[offset : offset + 3] = bytes(clear)
            rows.append(row)

        for y in range(285, 365):
            for x in range(915, 995):
                if ((x - 955) ** 2) + ((y - 325) ** 2) <= (28 ** 2):
                    offset = x * 3
                    rows[y][offset : offset + 3] = b"\xFF\xFF\xFF"

        with tempfile.TemporaryDirectory(prefix="sec3engine-png-fixture-") as temp_dir:
            screenshot_path = Path(temp_dir) / "shifted-particle-layout.png"
            screenshot_path.write_bytes(encode_rgb_png(width, height, rows))
            summary = summarize_canvas_region(screenshot_path)

        self.assertGreater(
            summary["bright_cluster_pixels"],
            1000,
            (
                "Canvas analysis should detect the bright particle cluster even when the particle canvas "
                f"moves away from the default page margin layout; observed summary: {summary}"
            ),
        )


@unittest.skipUnless(find_chrome_binary() is not None, "Google Chrome or Chromium is required for browser smoke tests")
@unittest.skipUnless(can_bind_localhost(), "Loopback HTTP server access is required for browser smoke tests")
class ParticleDemoBrowserSmokeTests(unittest.TestCase):
    def _run_particle_demo_headless(self):
        chrome = str(find_chrome_binary())
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
                screenshot_summary = summarize_canvas_region(screenshot_path) if screenshot_created else None

        return {
            "completed": completed,
            "screenshot_created": screenshot_created,
            "screenshot_summary": screenshot_summary,
            "requests": list(QuietHandler.requests),
            "response_log": list(QuietHandler.response_log),
        }

    def _assert_particle_demo_boot_invariants(self, result):
        completed = result["completed"]

        self.assertEqual(
            completed.returncode,
            0,
            f"Headless Chrome particle-demo smoke test failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )
        self.assertTrue(result["screenshot_created"], "Headless Chrome should produce a particle-demo screenshot")
        spark_texture_requests = [
            request_path for request_path in result["requests"] if request_path.startswith("/Sec3Engine/textures/spark.png")
        ]
        self.assertTrue(
            spark_texture_requests,
            "particleDemo.html should boot far enough to request its particle texture over HTTP",
        )
        self.assertTrue(
            any(
                response_path.startswith("/Sec3Engine/textures/spark.png") and response_code == 200
                for response_path, response_code in result["response_log"]
            ),
            "particleDemo.html should receive a successful HTTP response for its particle texture",
        )
        self.assertNotIn(
            "GL_INVALID_FRAMEBUFFER_OPERATION",
            completed.stderr,
            "particleDemo.html should not report framebuffer completeness errors during boot",
        )

    def test_particle_demo_does_not_report_framebuffer_errors_during_boot(self):
        result = self._run_particle_demo_headless()
        self._assert_particle_demo_boot_invariants(result)

    def test_particle_demo_renders_visible_pixels_in_canvas_region(self):
        result = self._run_particle_demo_headless()
        self._assert_particle_demo_boot_invariants(result)
        self.assertGreater(
            result["screenshot_summary"]["bright_cluster_pixels"],
            1000,
            (
                "particleDemo.html should render a bright particle cluster inside the canvas, not just its gray clear pass; "
                f"observed summary: {result['screenshot_summary']}"
            ),
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
