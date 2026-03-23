import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ObjLoaderTextureReadinessTests(unittest.TestCase):
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
            f"Node OBJ-loader probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )

    def test_obj_loader_waits_for_texture_image_src_before_reporting_ready(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/obj-loader.js"),
              "utf8"
            );

            function Mesh(geometry, material) {
              this.geometry = geometry;
              this.material = material;
            }

            function makeGeometry() {
              return {
                vertices: [
                  { x: 0, y: 0, z: 0 },
                  { x: 1, y: 0, z: 0 },
                  { x: 0, y: 1, z: 0 },
                ],
                faces: [
                  {
                    a: 0,
                    b: 1,
                    c: 2,
                    normal: { x: 0, y: 0, z: 1 },
                  },
                ],
                faceVertexUvs: [[[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]]],
              };
            }

            const child = new Mesh(
              makeGeometry(),
              { map: { image: { src: "" } } }
            );
            const loadedObject = {
              traverse(visitor) {
                visitor(child);
              },
            };

            const scene = {
              updateBounds() {},
            };

            const gl = {
              TEXTURE_2D: "TEXTURE_2D",
              RGBA: "RGBA",
              UNSIGNED_BYTE: "UNSIGNED_BYTE",
              LINEAR: "LINEAR",
              LINEAR_MIPMAP_NEAREST: "LINEAR_MIPMAP_NEAREST",
              REPEAT: "REPEAT",
              createTexture() {
                return {};
              },
              bindTexture() {},
              texImage2D() {},
              texParameteri() {},
              generateMipmap() {},
            };

            const sandbox = {
              Math,
              Float32Array,
              console,
              THREE: {
                Mesh,
                OBJMTLLoader: function OBJMTLLoader() {},
              },
              SEC3: {},
            };

            sandbox.THREE.OBJMTLLoader.prototype.load = function(_obj, _mtl, onLoad) {
              onLoad(loadedObject);
            };

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "obj-loader.js" });

            const loader = sandbox.SEC3.createOBJLoader(scene);
            loader.loadFromFile(gl, "dummy.obj", "dummy.mtl");

            assert.strictEqual(
              loader.isReady(),
              false,
              "OBJ loader should stay unready while texture image sources are still empty so GL uploads are not skipped"
            );
            """
        )

        self._run_node(script)

    def test_obj_loader_becomes_ready_after_texture_src_is_populated(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/obj-loader.js"),
              "utf8"
            );

            function Mesh(geometry, material) {
              this.geometry = geometry;
              this.material = material;
            }

            function makeGeometry() {
              return {
                vertices: [
                  { x: 0, y: 0, z: 0 },
                  { x: 1, y: 0, z: 0 },
                  { x: 0, y: 1, z: 0 },
                ],
                faces: [
                  {
                    a: 0,
                    b: 1,
                    c: 2,
                    normal: { x: 0, y: 0, z: 1 },
                  },
                ],
                faceVertexUvs: [[[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]]],
              };
            }

            const mapImage = { src: "" };
            const child = new Mesh(
              makeGeometry(),
              { map: { image: mapImage } }
            );
            const loadedObject = {
              traverse(visitor) {
                visitor(child);
              },
            };

            const scene = {
              updateBounds() {},
            };

            let uploadCount = 0;
            const gl = {
              TEXTURE_2D: "TEXTURE_2D",
              RGBA: "RGBA",
              UNSIGNED_BYTE: "UNSIGNED_BYTE",
              LINEAR: "LINEAR",
              LINEAR_MIPMAP_NEAREST: "LINEAR_MIPMAP_NEAREST",
              REPEAT: "REPEAT",
              createTexture() {
                return {};
              },
              bindTexture() {},
              texImage2D() {
                uploadCount += 1;
              },
              texParameteri() {},
              generateMipmap() {},
            };

            const sandbox = {
              Math,
              Float32Array,
              console,
              THREE: {
                Mesh,
                OBJMTLLoader: function OBJMTLLoader() {},
              },
              SEC3: {},
            };

            sandbox.THREE.OBJMTLLoader.prototype.load = function(_obj, _mtl, onLoad) {
              onLoad(loadedObject);
            };

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "obj-loader.js" });

            const loader = sandbox.SEC3.createOBJLoader(scene);
            loader.loadFromFile(gl, "dummy.obj", "dummy.mtl");

            assert.strictEqual(
              loader.isReady(),
              false,
              "OBJ loader should be unready before texture source is available"
            );

            mapImage.src = "http://127.0.0.1:8000/Sec3Engine/models/dabrovic-sponza/KAMEN.JPEG";
            assert.ok(
              loader.isReady(),
              "OBJ loader should flip to ready once texture source exists and upload completes"
            );
            assert.ok(
              uploadCount > 0,
              "OBJ loader readiness transition should trigger texture upload when source becomes available"
            );
            """
        )

        self._run_node(script)

    def test_obj_loader_handles_missing_map_or_image_without_throwing_and_stays_unready(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/obj-loader.js"),
              "utf8"
            );

            function Mesh(geometry, material) {
              this.geometry = geometry;
              this.material = material;
            }

            function makeGeometry() {
              return {
                vertices: [
                  { x: 0, y: 0, z: 0 },
                  { x: 1, y: 0, z: 0 },
                  { x: 0, y: 1, z: 0 },
                ],
                faces: [
                  {
                    a: 0,
                    b: 1,
                    c: 2,
                    normal: { x: 0, y: 0, z: 1 },
                  },
                ],
                faceVertexUvs: [[[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]]],
              };
            }

            const meshWithMissingMap = new Mesh(makeGeometry(), { map: null });
            const meshWithMissingImage = new Mesh(makeGeometry(), { map: {} });
            const loadedObject = {
              traverse(visitor) {
                visitor(meshWithMissingMap);
                visitor(meshWithMissingImage);
              },
            };

            const scene = {
              updateBounds() {},
            };

            const gl = {
              TEXTURE_2D: "TEXTURE_2D",
              RGBA: "RGBA",
              UNSIGNED_BYTE: "UNSIGNED_BYTE",
              LINEAR: "LINEAR",
              LINEAR_MIPMAP_NEAREST: "LINEAR_MIPMAP_NEAREST",
              REPEAT: "REPEAT",
              createTexture() {
                return {};
              },
              bindTexture() {},
              texImage2D() {},
              texParameteri() {},
              generateMipmap() {},
            };

            const sandbox = {
              Math,
              Float32Array,
              console,
              THREE: {
                Mesh,
                OBJMTLLoader: function OBJMTLLoader() {},
              },
              SEC3: {},
            };

            sandbox.THREE.OBJMTLLoader.prototype.load = function(_obj, _mtl, onLoad) {
              onLoad(loadedObject);
            };

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "obj-loader.js" });

            const loader = sandbox.SEC3.createOBJLoader(scene);
            loader.loadFromFile(gl, "dummy.obj", "dummy.mtl");

            assert.doesNotThrow(
              () => loader.isReady(),
              "OBJ loader readiness check should not throw when material maps/images are missing"
            );
            assert.strictEqual(
              loader.isReady(),
              false,
              "OBJ loader should stay unready when texture metadata is incomplete"
            );
            """
        )

        self._run_node(script)


if __name__ == "__main__":
    unittest.main(verbosity=2)
