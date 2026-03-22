import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class FullscreenEntrypointDefaultsTests(unittest.TestCase):
    def _read(self, relative_path):
        return (REPO_ROOT / relative_path).read_text(encoding="utf-8", errors="ignore")

    def _run_node(self, script):
        completed = subprocess.run(
            ["node", "-e", script],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            completed.returncode,
            0,
            f"Node fullscreen-resize probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )

    def test_html_entrypoints_declare_fullscreen_canvas_layout(self):
        expectations = [
            ("index.html", "webglview"),
            ("particleDemo.html", "glcanvas"),
            ("Sec3Engine/sec3index.html", "webglview"),
        ]
        for entrypoint, canvas_id in expectations:
            with self.subTest(entrypoint=entrypoint):
                source = self._read(entrypoint)
                self.assertIn("100vw", source, f"{entrypoint} should style its canvas layout to viewport width")
                self.assertIn("100vh", source, f"{entrypoint} should style its canvas layout to viewport height")
                self.assertIn(
                    "overflow: hidden",
                    source,
                    f"{entrypoint} should hide page overflow for fullscreen canvas layout",
                )
                self.assertIn(
                    f'id="{canvas_id}"',
                    source,
                    f"{entrypoint} should retain its expected canvas id while switching to fullscreen defaults",
                )

    def test_particle_demo_sync_canvas_scales_by_device_pixel_ratio(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/demos/ParticleDemo.js"),
              "utf8"
            );

            const sandbox = {
              console,
              Math,
              mat4: {
                create() {
                  return {};
                },
              },
              window: {
                innerWidth: 640,
                innerHeight: 360,
                devicePixelRatio: 2,
              },
            };
            sandbox.window.window = sandbox.window;
            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "ParticleDemo.js" });

            const canvas = { width: 1, height: 1 };
            sandbox.syncCanvasToWindow(canvas);
            assert.deepStrictEqual(
              [canvas.width, canvas.height],
              [1280, 720],
              "ParticleDemo syncCanvasToWindow should scale canvas pixel size by devicePixelRatio for fullscreen sharpness"
            );
            """
        )
        self._run_node(script)

    def test_particle_demo_resize_updates_canvas_viewport_and_projection(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/demos/ParticleDemo.js"),
              "utf8"
            );

            let resizeHandler = null;
            const viewportCalls = [];
            const perspectiveCalls = [];
            const canvas = { width: 1, height: 1 };
            const message = {};
            const gl = {
              COLOR_BUFFER_BIT: 1,
              DEPTH_BUFFER_BIT: 2,
              getExtension() {
                return {};
              },
              clearColor() {},
              viewport(...args) {
                viewportCalls.push(args);
              },
            };
            const camera = {
              setPerspective(...args) {
                perspectiveCalls.push(args);
              },
              goHome() {},
            };
            function Texture() {}
            Texture.prototype.setImage = function() {};

            const sandbox = {
              console,
              Math,
              SEC3: {
                resolveResourcePath(assetPath) {
                  return assetPath;
                },
              },
              SEC3ENGINE: {
                getWebGLContext() {
                  return gl;
                },
                createCamera() {
                  return camera;
                },
                ParticleInteractor() {
                  return {};
                },
                createParticleSystem() {
                  return {
                    stepParticles() {},
                    draw() {},
                    withRenderPrograms() {},
                    stepProgram: { ref() { return {}; } },
                    restart() {},
                  };
                },
                run() {},
              },
              CAMERA_TRACKING_TYPE: 1,
              Texture,
              UI: function() {},
              document: {
                getElementById(id) {
                  if (id === "glcanvas") return canvas;
                  if (id === "message") return message;
                  throw new Error("unexpected id " + id);
                },
              },
              requestAnimationFrame() {},
              mat4: {
                create() {
                  return {};
                },
              },
              alert(messageText) {
                throw new Error(messageText);
              },
              window: {
                innerWidth: 800,
                innerHeight: 600,
                devicePixelRatio: 1,
                addEventListener(event, handler) {
                  if (event === "resize") {
                    resizeHandler = handler;
                  }
                },
              },
            };
            sandbox.window.window = sandbox.window;

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "ParticleDemo.js" });
            sandbox.webGLStart();

            assert.ok(
              typeof resizeHandler === "function",
              "ParticleDemo should register a resize handler so fullscreen canvas state tracks window changes"
            );

            sandbox.window.innerWidth = 1024;
            sandbox.window.innerHeight = 512;
            sandbox.window.devicePixelRatio = 2;
            resizeHandler();

            const lastPerspective = perspectiveCalls[perspectiveCalls.length - 1];
            assert.deepStrictEqual(
              [canvas.width, canvas.height, gl.viewportWidth, gl.viewportHeight, viewportCalls[viewportCalls.length - 1]],
              [2048, 1024, 2048, 1024, [0, 0, 2048, 1024]],
              "ParticleDemo resize flow should update canvas pixels and viewport to fullscreen-dpr dimensions"
            );
            assert.strictEqual(
              lastPerspective[1],
              2,
              "ParticleDemo resize flow should update camera aspect to match the new canvas dimensions"
            );
            """
        )
        self._run_node(script)

    def test_sec3demo_sync_canvas_scales_by_device_pixel_ratio(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/demos/SEC3DEMO.js"),
              "utf8"
            );

            const sandbox = {
              console,
              Math,
              vec3: {
                fromValues(x, y, z) {
                  return [x, y, z];
                },
              },
              mat4: {
                create() {
                  return {};
                },
                translate() {},
              },
              window: {
                innerWidth: 900,
                innerHeight: 500,
                devicePixelRatio: 2,
              },
            };
            sandbox.window.window = sandbox.window;

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "SEC3DEMO.js" });

            const canvas = { width: 1, height: 1 };
            sandbox.syncCanvasToWindow(canvas);
            assert.deepStrictEqual(
              [canvas.width, canvas.height],
              [1800, 1000],
              "SEC3DEMO syncCanvasToWindow should scale canvas pixel size by devicePixelRatio for fullscreen sharpness"
            );
            """
        )
        self._run_node(script)

    def test_sec3demo_setup_registers_resize_handler_and_resizes_fbos(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/demos/SEC3DEMO.js"),
              "utf8"
            );

            let resizeHandler = null;
            const pendingAnimationFrames = [];
            const viewportCalls = [];
            const perspectiveCalls = [];
            const fboInitializations = [];
            const canvas = { width: 1, height: 1 };
            const message = {};
            const gl = {
              DEPTH_TEST: "DEPTH_TEST",
              LESS: "LESS",
              viewport(...args) {
                viewportCalls.push(args);
              },
              clearColor() {},
              enable() {},
              depthFunc() {},
            };

            const sandbox = {
              console,
              Math,
              vec2: {
                fromValues(x, y) {
                  return [x, y];
                },
              },
              vec3: {
                fromValues(x, y, z) {
                  return [x, y, z];
                },
              },
              mat4: {
                create() {
                  return {};
                },
                translate() {},
                multiply() {},
              },
              document: {
                getElementById(id) {
                  if (id === "webglview") return canvas;
                  if (id === "message") return message;
                  throw new Error("unexpected id " + id);
                },
              },
              window: {
                innerWidth: 1200,
                innerHeight: 700,
                devicePixelRatio: 1,
                addEventListener(event, handler) {
                  if (event === "resize") {
                    resizeHandler = handler;
                  }
                },
                requestAnimationFrame(callback) {
                  pendingAnimationFrames.push(callback);
                  return pendingAnimationFrames.length;
                },
              },
              SEC3: {
                canvas: null,
                getWebGLContext() {
                  return gl;
                },
                Scene: function Scene() {
                  return {
                    addLight() {},
                    setCamera() {},
                  };
                },
                Camera: function Camera() {
                  return {
                    goHome() {},
                    setAzimuth() {},
                    setElevation() {},
                    setPerspective(...args) {
                      perspectiveCalls.push(args);
                    },
                  };
                },
                CameraInteractor() {
                  return {};
                },
                SpotLight: function SpotLight() {
                  return {
                    goHome() {},
                    setAzimuth() {},
                    setElevation() {},
                    setPerspective() {},
                    setupCascades() {},
                  };
                },
                createParticleSystem() {
                  return {};
                },
                createFBO() {
                  return {
                    initialize(_gl, width, height, attachments) {
                      fboInitializations.push([width, height, attachments || 1]);
                      return true;
                    },
                  };
                },
                resolveResourcePath(assetPath) {
                  return assetPath;
                },
              },
            };
            sandbox.window.window = sandbox.window;

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "SEC3DEMO.js" });
            sandbox.loadObjects = function() {};
            sandbox.setupScene("webglview", "message");

            assert.ok(
              typeof resizeHandler === "function",
              "SEC3DEMO should register a resize handler so fullscreen canvas/FBO state tracks window changes"
            );
            const initialInitCount = fboInitializations.length;

            sandbox.window.innerWidth = 1000;
            sandbox.window.innerHeight = 500;
            sandbox.window.devicePixelRatio = 2;
            resizeHandler();
            pendingAnimationFrames.shift()();

            const lastViewport = viewportCalls[viewportCalls.length - 1];
            const lastPerspective = perspectiveCalls[perspectiveCalls.length - 1];
            const resizedInitCalls = fboInitializations.slice(initialInitCount);

            assert.deepStrictEqual(
              [canvas.width, canvas.height, gl.viewportWidth, gl.viewportHeight, lastViewport],
              [2000, 1000, 2000, 1000, [0, 0, 2000, 1000]],
              "SEC3DEMO resize flow should update canvas pixels and viewport to fullscreen-dpr dimensions"
            );
            assert.strictEqual(
              lastPerspective[1],
              2,
              "SEC3DEMO resize flow should update camera aspect to match the new canvas dimensions"
            );
            assert.ok(
              resizedInitCalls.some((entry) => entry[0] === 2000 && entry[1] === 1000),
              "SEC3DEMO resize flow should rebuild at least one size-dependent render target for the new fullscreen dimensions"
            );
            """
        )
        self._run_node(script)

    def test_sec3demo_resize_handler_coalesces_reallocation_work_per_animation_frame(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/demos/SEC3DEMO.js"),
              "utf8"
            );

            let resizeHandler = null;
            const pendingAnimationFrames = [];
            const fboInitializations = [];
            const canvas = { width: 1, height: 1 };
            const message = {};
            const gl = {
              DEPTH_TEST: "DEPTH_TEST",
              LESS: "LESS",
              viewport() {},
              clearColor() {},
              enable() {},
              depthFunc() {},
            };

            const sandbox = {
              console,
              Math,
              vec2: {
                fromValues(x, y) {
                  return [x, y];
                },
              },
              vec3: {
                fromValues(x, y, z) {
                  return [x, y, z];
                },
              },
              mat4: {
                create() {
                  return {};
                },
                translate() {},
                multiply() {},
              },
              document: {
                getElementById(id) {
                  if (id === "webglview") return canvas;
                  if (id === "message") return message;
                  throw new Error("unexpected id " + id);
                },
              },
              window: {
                innerWidth: 1200,
                innerHeight: 700,
                devicePixelRatio: 2,
                addEventListener(event, handler) {
                  if (event === "resize") {
                    resizeHandler = handler;
                  }
                },
                requestAnimationFrame(callback) {
                  pendingAnimationFrames.push(callback);
                  return pendingAnimationFrames.length;
                },
              },
              SEC3: {
                canvas: null,
                getWebGLContext() {
                  return gl;
                },
                Scene: function Scene() {
                  return {
                    addLight() {},
                    setCamera() {},
                  };
                },
                Camera: function Camera() {
                  return {
                    goHome() {},
                    setAzimuth() {},
                    setElevation() {},
                    setPerspective() {},
                  };
                },
                CameraInteractor() {
                  return {};
                },
                SpotLight: function SpotLight() {
                  return {
                    goHome() {},
                    setAzimuth() {},
                    setElevation() {},
                    setPerspective() {},
                    setupCascades() {},
                  };
                },
                createParticleSystem() {
                  return {};
                },
                createFBO() {
                  return {
                    initialize(_gl, width, height, attachments) {
                      fboInitializations.push([width, height, attachments || 1]);
                      return true;
                    },
                  };
                },
                resolveResourcePath(assetPath) {
                  return assetPath;
                },
              },
            };
            sandbox.window.window = sandbox.window;

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "SEC3DEMO.js" });
            sandbox.loadObjects = function() {};
            sandbox.setupScene("webglview", "message");

            const initialInitCount = fboInitializations.length;
            assert.ok(typeof resizeHandler === "function");

            sandbox.window.innerWidth = 1400;
            sandbox.window.innerHeight = 800;
            resizeHandler();
            sandbox.window.innerWidth = 1500;
            sandbox.window.innerHeight = 900;
            resizeHandler();

            assert.deepStrictEqual(
              {
                pendingAnimationFrames: pendingAnimationFrames.length,
                resizedInitCallsBeforeFrame: fboInitializations.slice(initialInitCount),
              },
              {
                pendingAnimationFrames: 1,
                resizedInitCallsBeforeFrame: [],
              },
              "SEC3DEMO should coalesce repeated resize events into one pending animation-frame resize instead of reallocating render targets immediately"
            );

            pendingAnimationFrames.shift()();

            const resizedInitCalls = fboInitializations.slice(initialInitCount);
            assert.strictEqual(
              resizedInitCalls.length,
              6,
              "SEC3DEMO should resize its six fullscreen-sized render targets once after the coalesced animation-frame callback runs"
            );
            assert.ok(
              resizedInitCalls.every((entry) => entry[0] === 3000 && entry[1] === 1800),
              "SEC3DEMO should apply the latest resize dimensions when the coalesced resize work finally runs"
            );
            """
        )
        self._run_node(script)

    def test_sec3demo_setup_cancels_stale_queued_resize_frame_when_reinitialized(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/demos/SEC3DEMO.js"),
              "utf8"
            );

            let resizeHandler = null;
            const pendingAnimationFrames = [];
            const canceledAnimationFrames = [];
            const canvas = { width: 1, height: 1 };
            const message = {};
            const gl = {
              DEPTH_TEST: "DEPTH_TEST",
              LESS: "LESS",
              viewport() {},
              clearColor() {},
              enable() {},
              depthFunc() {},
            };

            const sandbox = {
              console,
              Math,
              vec2: {
                fromValues(x, y) {
                  return [x, y];
                },
              },
              vec3: {
                fromValues(x, y, z) {
                  return [x, y, z];
                },
              },
              mat4: {
                create() {
                  return {};
                },
                translate() {},
                multiply() {},
              },
              document: {
                getElementById(id) {
                  if (id === "webglview") return canvas;
                  if (id === "message") return message;
                  throw new Error("unexpected id " + id);
                },
              },
              window: {
                innerWidth: 1200,
                innerHeight: 700,
                devicePixelRatio: 2,
                addEventListener(event, handler) {
                  if (event === "resize") {
                    resizeHandler = handler;
                  }
                },
                requestAnimationFrame(callback) {
                  pendingAnimationFrames.push(callback);
                  return pendingAnimationFrames.length;
                },
                cancelAnimationFrame(token) {
                  canceledAnimationFrames.push(token);
                },
              },
              SEC3: {
                canvas: null,
                getWebGLContext() {
                  return gl;
                },
                Scene: function Scene() {
                  return {
                    addLight() {},
                    setCamera() {},
                  };
                },
                Camera: function Camera() {
                  return {
                    goHome() {},
                    setAzimuth() {},
                    setElevation() {},
                    setPerspective() {},
                  };
                },
                CameraInteractor() {
                  return {};
                },
                SpotLight: function SpotLight() {
                  return {
                    goHome() {},
                    setAzimuth() {},
                    setElevation() {},
                    setPerspective() {},
                    setupCascades() {},
                  };
                },
                createParticleSystem() {
                  return {};
                },
                createFBO() {
                  return {
                    initialize() {
                      return true;
                    },
                  };
                },
                resolveResourcePath(assetPath) {
                  return assetPath;
                },
              },
            };
            sandbox.window.window = sandbox.window;

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "SEC3DEMO.js" });
            sandbox.loadObjects = function() {};

            sandbox.setupScene("webglview", "message");
            assert.ok(typeof resizeHandler === "function");

            resizeHandler();
            assert.strictEqual(
              pendingAnimationFrames.length,
              1,
              "The first resize should queue a pending animation-frame resize task"
            );

            sandbox.setupScene("webglview", "message");

            assert.deepStrictEqual(
              canceledAnimationFrames,
              [1],
              "Reinitializing SEC3DEMO should cancel the stale pending resize animation-frame callback before rebinding handlers"
            );
            """
        )
        self._run_node(script)


if __name__ == "__main__":
    unittest.main(verbosity=2)
