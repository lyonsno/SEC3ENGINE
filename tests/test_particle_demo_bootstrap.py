import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ParticleDemoBootstrapTests(unittest.TestCase):
    def test_particle_demo_bootstrap_sets_canvas_camera_and_steps_particles(self):
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

            const calls = [];
            const canvas = { width: 500, height: 500 };
            const message = {};
            const gl = {
              COLOR_BUFFER_BIT: 1,
              DEPTH_BUFFER_BIT: 2,
              getExtension() {
                return {};
              },
              clearColor(...args) {
                calls.push(["clearColor", ...args]);
              },
              viewport(...args) {
                calls.push(["viewport", ...args]);
              },
              clear(mask) {
                calls.push(["clear", mask]);
              },
            };

            const particleSystem = {
              stepParticles() {
                calls.push("stepParticles");
              },
              draw() {
                calls.push("draw");
              },
            };

            const camera = {
              setPerspective(...args) {
                calls.push(["setPerspective", ...args]);
              },
              goHome(...args) {
                calls.push(["goHome", ...args]);
              },
            };

            function Texture() {}
            Texture.prototype.setImage = function(assetPath) {
              calls.push(["setImage", assetPath]);
            };

            const sandbox = {
              console,
              Math,
              SEC3: {
                resolveResourcePath(assetPath) {
                  calls.push(["resolveResourcePath", assetPath]);
                  return assetPath;
                },
              },
              SEC3ENGINE: {
                resolveResourcePath(assetPath) {
                  calls.push(["resolveResourcePath", assetPath]);
                  return assetPath;
                },
                getWebGLContext(canvasArg, messageArg) {
                  calls.push(["getWebGLContext", canvasArg === canvas, messageArg === message]);
                  return gl;
                },
                createCamera(cameraType) {
                  calls.push(["createCamera", cameraType]);
                  return camera;
                },
                ParticleInteractor(canvasArg) {
                  calls.push(["ParticleInteractor", canvasArg === canvas]);
                  return {};
                },
                createParticleSystem(specs) {
                  calls.push(["createParticleSystem", Boolean(specs)]);
                  return particleSystem;
                },
                run(glArg) {
                  calls.push(["run", glArg === gl]);
                },
              },
              CAMERA_TRACKING_TYPE: 1,
              Texture,
              UI: function() {},
              document: {
                getElementById(id) {
                  if (id === "glcanvas") return canvas;
                  if (id === "message") return message;
                  throw new Error("Unexpected element lookup: " + id);
                },
              },
              requestAnimationFrame() {},
              mat4: {
                create() {
                  return {};
                },
              },
              alert(messageText) {
                throw new Error("Unexpected alert: " + messageText);
              },
              window: {},
            };
            sandbox.window = sandbox;

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "ParticleDemo.js" });

            sandbox.webGLStart();
            sandbox.drawScene();

            assert.strictEqual(sandbox.SEC3.canvas, canvas, "webGLStart should publish the active canvas on SEC3");
            assert.deepStrictEqual(
              calls.find((entry) => Array.isArray(entry) && entry[0] === "setPerspective"),
              ["setPerspective", 60, 1, 0.6, 30],
              "webGLStart should configure a usable particle-demo projection"
            );
            assert.ok(
              calls.some((entry) => Array.isArray(entry) && entry[0] === "createParticleSystem"),
              "webGLStart should create the particle system"
            );

            const stepIndex = calls.indexOf("stepParticles");
            const drawIndex = calls.indexOf("draw");
            assert.notStrictEqual(stepIndex, -1, "drawScene should advance particles");
            assert.notStrictEqual(drawIndex, -1, "drawScene should render particles");
            assert.ok(stepIndex < drawIndex, "drawScene should step particles before drawing");
            """
        )

        completed = subprocess.run(
            ["node", "-e", script],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )

        self.assertEqual(
            completed.returncode,
            0,
            f"Node particle-demo bootstrap smoke test failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
