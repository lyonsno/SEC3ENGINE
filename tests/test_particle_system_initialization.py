import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ParticleSystemInitializationTests(unittest.TestCase):
    def test_particle_system_initialization_restores_default_framebuffer(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/ParticleSystem.js"),
              "utf8"
            );

            let currentFramebuffer = null;
            const boundFramebuffers = [];
            const createdPrograms = [];
            const gl = {
              FRAMEBUFFER: "FRAMEBUFFER",
              ARRAY_BUFFER: "ARRAY_BUFFER",
              TEXTURE_2D: "TEXTURE_2D",
              TRIANGLES: "TRIANGLES",
              RGBA: "RGBA",
              FLOAT: "FLOAT",
              CLAMP_TO_EDGE: "CLAMP_TO_EDGE",
              NEAREST: "NEAREST",
              COLOR_ATTACHMENT0_WEBGL: "ATT0",
              COLOR_ATTACHMENT1_WEBGL: "ATT1",
              createTexture() {
                return {};
              },
              bindTexture() {},
              texParameteri() {},
              texImage2D() {},
              createFramebuffer() {
                return { kind: "particle-fbo" };
              },
              bindFramebuffer(target, framebuffer) {
                currentFramebuffer = framebuffer;
                boundFramebuffers.push(framebuffer);
              },
              useProgram() {},
              getAttribLocation() {
                return 0;
              },
              getUniformLocation() {
                return {};
              },
              uniform1f() {},
              createBuffer() {
                return {};
              },
              bindBuffer() {},
              bufferData() {},
              vertexAttribPointer() {},
              clear() {
                assert.strictEqual(
                  currentFramebuffer,
                  null,
                  "Particle-system initialization should leave the default framebuffer bound before the first frame"
                );
              },
            };

            const sandbox = {
              console,
              Math,
              Float32Array,
              Uint8Array,
              gl,
              vec2: {
                fromValues(x, y) {
                  return [x, y];
                },
              },
              vec3: {
                fromValues(x, y, z) {
                  return [x, y, z];
                },
                normalize(out, input) {
                  const length = Math.sqrt(input[0] ** 2 + input[1] ** 2 + input[2] ** 2) || 1;
                  out[0] = input[0] / length;
                  out[1] = input[1] / length;
                  out[2] = input[2] / length;
                  return out;
                },
                scale(out, input, scalar) {
                  out[0] = input[0] * scalar;
                  out[1] = input[1] * scalar;
                  out[2] = input[2] * scalar;
                  return out;
                },
                dot(a, b) {
                  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
                },
              },
              mat4: {
                create() {
                  return {};
                },
              },
              SEC3: {
                registerAsyncObj() {},
                resolveResourcePath(assetPath) {
                  return assetPath;
                },
                math: {
                  roundUpToPower(value) {
                    return Math.pow(2, Math.ceil(Math.log2(value)));
                  },
                },
                geometry: {
                  fullScreenQuad() {
                    return [0, 0, 1, 0, 1, 1];
                  },
                },
                createBuffer() {
                  return {};
                },
                extensions: {
                  drawBuffers() {
                    return {
                      COLOR_ATTACHMENT0_WEBGL: "ATT0",
                      COLOR_ATTACHMENT1_WEBGL: "ATT1",
                      drawBuffersWEBGL() {},
                    };
                  },
                },
                createShaderProgram() {
                  const program = {
                    loadShader(...args) {
                      program.shaderPaths = args.filter((value) => typeof value === "string");
                    },
                    ref() {
                      return program;
                    },
                    addCallback(callback) {
                      program.callback = callback;
                    },
                  };
                  createdPrograms.push(program);
                  return program;
                },
              },
            };

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "ParticleSystem.js" });

            sandbox.SEC3.createParticleSystem({
              maxParticles: 4,
              gravityModifier: 0,
              activeBodies: 0,
              particleSize: 1,
              damping: 1,
              RGBA: [1, 1, 1, 1],
              luminence: 1,
              scatterMultiply: 1,
              shadowMultiply: 1,
              scale: 1,
            });

            const initBuffersProgram = createdPrograms.find(
              (program) =>
                program.callback &&
                Array.isArray(program.shaderPaths) &&
                program.shaderPaths.some((shaderPath) => shaderPath.includes("nBodyUpdate.vert"))
            );
            assert.ok(
              initBuffersProgram,
              "Particle-system initialization should register the nBody update shader callback before the first frame"
            );
            initBuffersProgram.callback();
            assert.ok(
              boundFramebuffers.some((framebuffer) => framebuffer !== null),
              "The nBody update shader callback should bind an offscreen framebuffer before restoring the default framebuffer"
            );

            gl.clear(0);
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
            f"Node particle-system initialization probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )

    def test_particle_system_restart_rebuilds_texture_uploads_after_resize(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/ParticleSystem.js"),
              "utf8"
            );

            const uploadMismatches = [];
            const createBufferCalls = [];
            const gl = {
              FRAMEBUFFER: "FRAMEBUFFER",
              ARRAY_BUFFER: "ARRAY_BUFFER",
              TEXTURE_2D: "TEXTURE_2D",
              RGBA: "RGBA",
              FLOAT: "FLOAT",
              CLAMP_TO_EDGE: "CLAMP_TO_EDGE",
              NEAREST: "NEAREST",
              createTexture() {
                return {};
              },
              bindTexture() {},
              texParameteri() {},
              texImage2D(target, level, internalFormat, width, height, border, format, type, data) {
                if (data instanceof Float32Array) {
                  if (data.length !== width * height * 4) {
                    uploadMismatches.push([width, height, data.length]);
                  }
                }
              },
              createFramebuffer() {
                return {};
              },
              bindFramebuffer() {},
            };

            const sandbox = {
              console,
              Math,
              Float32Array,
              Uint8Array,
              gl,
              vec2: {
                fromValues(x, y) {
                  return [x, y];
                },
              },
              vec3: {
                fromValues(x, y, z) {
                  return [x, y, z];
                },
                normalize(out, input) {
                  const length = Math.sqrt(input[0] ** 2 + input[1] ** 2 + input[2] ** 2) || 1;
                  out[0] = input[0] / length;
                  out[1] = input[1] / length;
                  out[2] = input[2] / length;
                  return out;
                },
                scale(out, input, scalar) {
                  out[0] = input[0] * scalar;
                  out[1] = input[1] * scalar;
                  out[2] = input[2] * scalar;
                  return out;
                },
                dot(a, b) {
                  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
                },
              },
              mat4: {
                create() {
                  return {};
                },
              },
              SEC3: {
                registerAsyncObj() {},
                resolveResourcePath(assetPath) {
                  return assetPath;
                },
                math: {
                  roundUpToPower(value) {
                    return Math.pow(2, Math.ceil(Math.log2(value)));
                  },
                },
                geometry: {
                  fullScreenQuad() {
                    return [0, 0, 1, 0, 1, 1];
                  },
                },
                createBuffer(itemSize, numItems, content) {
                  createBufferCalls.push([itemSize, numItems, Array.from(content)]);
                  return {};
                },
                extensions: {
                  drawBuffers() {
                    return {
                      COLOR_ATTACHMENT0_WEBGL: "ATT0",
                      COLOR_ATTACHMENT1_WEBGL: "ATT1",
                      drawBuffersWEBGL() {},
                    };
                  },
                },
                createShaderProgram() {
                  return {
                    loadShader() {},
                    ref() {
                      return {};
                    },
                    addCallback() {},
                  };
                },
              },
            };

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "ParticleSystem.js" });

            const system = sandbox.SEC3.createParticleSystem({
              maxParticles: 4,
              gravityModifier: 0,
              activeBodies: 0,
              particleSize: 1,
              damping: 1,
              RGBA: [1, 1, 1, 1],
              luminence: 1,
              scatterMultiply: 1,
              shadowMultiply: 1,
              scale: 1,
            });

            createBufferCalls.length = 0;
            system.textureSideLength = 4;
            system.maxParticles = 16;
            system.restart();

            const indexBufferCall = createBufferCalls.find((entry) => entry[0] === 2 && entry[1] === 16);
            const expectedIndexUvs = [];
            for (let y = 0; y < 4; y += 1) {
              for (let x = 0; x < 4; x += 1) {
                expectedIndexUvs.push(x / 4, y / 4);
              }
            }
            assert.deepStrictEqual(
              {
                uploadMismatches,
                indexBufferCall,
                limit: system.limit,
              },
              {
                uploadMismatches: [],
                indexBufferCall: [2, 16, expectedIndexUvs],
                limit: 16,
              },
              "Particle-system resize should rebuild texture uploads, row-major particle-index UVs, and draw count for the new particle grid"
            );
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
            f"Node particle-system restart probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
