import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ChunkerAndFboCleanupTests(unittest.TestCase):
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
            f"Node chunker/FBO probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )

    def test_chunker_does_not_log_full_shader_source_during_normal_generation(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/Chunker.js"),
              "utf8"
            );

            const logs = [];
            const sandbox = {
              Math,
              console: {
                log(...args) {
                  logs.push(args.join(" "));
                },
              },
              SEC3: {
                SpotLight: function SpotLight() {},
                DiLight: function DiLight() {},
                Chunker: {},
              },
            };

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "Chunker.js" });

            const light = new sandbox.SEC3.SpotLight();
            light.numCascades = 1;
            light.cascadeFramebuffers = [
              {
                getWidth() {
                  return 512;
                },
              },
            ];

            const scene = {
              getCamera() {
                return { zNear: 0.6, zFar: 30.0 };
              },
              getNumLights() {
                return 1;
              },
              getLight() {
                return light;
              },
            };

            const shaderSource = sandbox.SEC3.Chunker.renderCascadedShadowMapsFS(scene);

            assert.ok(
              shaderSource.includes("gl_FragData[0]"),
              "Chunker should still generate the cascaded-shadow fragment shader source"
            );
            assert.deepStrictEqual(
              logs,
              [],
              "Chunker should not dump the full generated shader source to console during normal generation"
            );
            """
        )

        self._run_node(script)

    def test_fbo_dispose_uses_global_gl_when_no_argument_is_provided(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/fbo-util.js"),
              "utf8"
            );

            const deletedTextures = [];
            const deletedFramebuffers = [];
            const globalGl = {
              TEXTURE_2D: "TEXTURE_2D",
              FRAMEBUFFER: "FRAMEBUFFER",
              DEPTH_STENCIL_ATTACHMENT: "DEPTH_STENCIL_ATTACHMENT",
              DEPTH_STENCIL: "DEPTH_STENCIL",
              FLOAT: "FLOAT",
              RGBA: "RGBA",
              CLAMP_TO_EDGE: "CLAMP_TO_EDGE",
              NEAREST: "NEAREST",
              FRAMEBUFFER_COMPLETE: "FRAMEBUFFER_COMPLETE",
              getExtension(name) {
                if (name === "WEBGL_draw_buffers") {
                  return {
                    COLOR_ATTACHMENT0_WEBGL: "ATT0",
                    COLOR_ATTACHMENT1_WEBGL: "ATT1",
                    COLOR_ATTACHMENT2_WEBGL: "ATT2",
                    COLOR_ATTACHMENT3_WEBGL: "ATT3",
                    drawBuffersWEBGL() {},
                  };
                }
                if (name === "WEBGL_depth_texture") {
                  return { UNSIGNED_INT_24_8_WEBGL: "UNSIGNED_INT_24_8_WEBGL" };
                }
                return {};
              },
              createTexture() {
                return { kind: "texture", id: deletedTextures.length };
              },
              bindTexture() {},
              texParameteri() {},
              texImage2D() {},
              createFramebuffer() {
                return { kind: "fbo" };
              },
              bindFramebuffer() {},
              framebufferTexture2D() {},
              checkFramebufferStatus() {
                return "FRAMEBUFFER_COMPLETE";
              },
              deleteTexture(texture) {
                deletedTextures.push(texture);
              },
              deleteFramebuffer(framebuffer) {
                deletedFramebuffers.push(framebuffer);
              },
            };

            const sandbox = {
              Math,
              Float32Array,
              console,
              alert(message) {
                throw new Error("Unexpected alert: " + message);
              },
              gl: globalGl,
              SEC3: {},
            };

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "fbo-util.js" });

            const fbo = sandbox.SEC3.createFBO();
            assert.ok(
              fbo.initialize(globalGl, 4, 4, 1),
              "The FBO helper should initialize successfully in the test harness"
            );

            fbo.dispose();

            assert.strictEqual(
              deletedTextures.length,
              2,
              "FBO disposal should delete the color texture and depth texture even when no explicit gl argument is passed"
            );
            assert.strictEqual(
              deletedFramebuffers.length,
              1,
              "FBO disposal should delete the framebuffer object even when no explicit gl argument is passed"
            );
            """
        )

        self._run_node(script)


if __name__ == "__main__":
    unittest.main(verbosity=2)
