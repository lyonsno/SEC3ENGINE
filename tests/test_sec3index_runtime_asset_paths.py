import json
import subprocess
import textwrap
import unittest
import urllib.parse
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SEC3INDEX_ENTRYPOINT = "/Sec3Engine/sec3index.html"


class Sec3IndexRuntimeAssetPathTests(unittest.TestCase):
    def _resolve_local_asset_path(self, entrypoint_path, asset_path):
        base_url = f"https://repo.local{entrypoint_path}"
        asset_url = urllib.parse.urljoin(base_url, asset_path)
        asset_repo_path = urllib.parse.urlparse(asset_url).path.lstrip("/")
        resolved = (REPO_ROOT / asset_repo_path).resolve()
        if not resolved.is_relative_to(REPO_ROOT):
            return None
        return resolved

    def _collect_runtime_asset_requests(self):
        script = textwrap.dedent(
            r"""
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const requested = [];

            function evaluate(relativePath, sandbox) {
              const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
              vm.runInContext(source, sandbox, { filename: relativePath });
            }

            function XMLHttpRequest() {}
            XMLHttpRequest.prototype.open = function(method, url) {
              requested.push(url);
            };
            XMLHttpRequest.prototype.send = function() {};

            const sandbox = {
              console,
              Math,
              JSON,
              Uint8Array,
              Float32Array,
              window: {},
              document: {},
              XMLHttpRequest,
              THREE: {
                Mesh: function Mesh() {},
                OBJLoader: function() {
                  this.load = function(filename) {
                    requested.push(filename);
                  };
                },
                OBJMTLLoader: function() {
                  this.load = function(filename, mtl) {
                    requested.push(filename);
                    requested.push(mtl);
                  };
                },
              },
              SEC3: {
                registerAsyncObj() {},
                Chunker: {
                  renderCascadedShadowMapsVS() {
                    return "void main() {}";
                  },
                  renderCascadedShadowMapsFS() {
                    return "void main() {}";
                  },
                },
              },
              gl: {
                VERTEX_SHADER: 0x8B31,
                FRAGMENT_SHADER: 0x8B30,
              },
              scene: {
                getNumLights() {
                  return 0;
                },
                getCamera() {
                  return { zNear: 0.1, zFar: 30.0 };
                },
                updateBounds() {},
              },
              vec2: {
                fromValues(x, y) {
                  return [x, y];
                },
              },
              vec3: {
                fromValues(x, y, z) {
                  return [x, y, z];
                },
                scale(vec, source, scalar) {
                  vec[0] = source[0] * scalar;
                  vec[1] = source[1] * scalar;
                  vec[2] = source[2] * scalar;
                  return vec;
                },
                dot(a, b) {
                  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
                },
                normalize(vec, source) {
                  const length = Math.sqrt(source[0] ** 2 + source[1] ** 2 + source[2] ** 2) || 1;
                  vec[0] = source[0] / length;
                  vec[1] = source[1] / length;
                  vec[2] = source[2] / length;
                  return vec;
                },
              },
              mat4: {
                create() {
                  return {};
                },
                translate() {},
              },
            };
            sandbox.window = sandbox;
            sandbox.self = sandbox;
            sandbox.location = { pathname: "/Sec3Engine/sec3index.html" };
            sandbox.window.location = sandbox.location;

            vm.createContext(sandbox);

            evaluate("Sec3Engine/js/core/shader-util.js", sandbox);
            evaluate("Sec3Engine/js/core/obj-loader.js", sandbox);
            evaluate("Sec3Engine/js/core/ParticleSystem.js", sandbox);
            evaluate("Sec3Engine/demos/SEC3DEMO.js", sandbox);
            evaluate("Sec3Engine/js/core/shaderCreator.js", sandbox);
            sandbox.SEC3.ShaderCreator.renderCascShadowProg = function() {
              return {};
            };
            evaluate("Sec3Engine/js/core/postFx.js", sandbox);
            evaluate("Sec3Engine/js/core/renderer.js", sandbox);

            sandbox.SEC3.math = {
              roundUpToPower(value) {
                return Math.pow(2, Math.ceil(Math.log2(value)));
              },
            };
            sandbox.SEC3.createBuffer = function() {
              return {};
            };
            sandbox.SEC3.geometry = {
              fullScreenQuad() {
                return [0, 0, 1, 0, 1, 1];
              },
            };
            sandbox.SEC3.extensions = {
              drawBuffers() {
                return {
                  COLOR_ATTACHMENT0_WEBGL: 0,
                  COLOR_ATTACHMENT1_WEBGL: 1,
                  drawBuffersWEBGL() {},
                };
              },
            };

            sandbox.SEC3.postFx.init();
            sandbox.SEC3.renderer.init();
            sandbox.SEC3.createParticleSystem({
              maxParticles: 4,
              gravityModifier: 0,
              activeBodies: 1,
              particleSize: 1,
              damping: 1,
              RGBA: [1, 1, 1, 1],
              luminence: 1,
              scatterMultiply: 1,
              shadowMultiply: 1,
              scale: 1,
            });
            sandbox.loadObjects();

            process.stdout.write(JSON.stringify(Array.from(new Set(requested))));
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
            f"Node sec3index runtime asset probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )
        return json.loads(completed.stdout)

    def test_sec3index_runtime_assets_resolve_from_page_location(self):
        runtime_asset_paths = self._collect_runtime_asset_requests()

        self.assertIn(
            "./shader/deferredRenderPass1.vert",
            runtime_asset_paths,
            "sec3index should request deferred-render shaders during bootstrap",
        )
        self.assertIn(
            "./shader/nBodyRender.vert",
            runtime_asset_paths,
            "sec3index should request particle-system shaders during bootstrap",
        )
        self.assertIn(
            "./models/dabrovic-sponza/sponza3.obj",
            runtime_asset_paths,
            "sec3index should request the scene model during bootstrap",
        )

        failures = []
        for asset_path in runtime_asset_paths:
            if asset_path.startswith(("http://", "https://", "//")):
                continue
            resolved_path = self._resolve_local_asset_path(SEC3INDEX_ENTRYPOINT, asset_path)
            if resolved_path is None or not resolved_path.exists():
                failures.append(asset_path)

        self.assertEqual(
            failures,
            [],
            (
                f"{SEC3INDEX_ENTRYPOINT} should only request runtime shader/model assets "
                f"that resolve from the page location: {failures}"
            ),
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
