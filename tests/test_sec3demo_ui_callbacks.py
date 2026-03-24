import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class Sec3DemoUiCallbackTests(unittest.TestCase):
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
            f"Node SEC3 demo callback probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )

    def test_spotlight_setup_cascades_passes_gl_to_dispose_buffers(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/SpotLight.js"),
              "utf8"
            );

            const calls = [];
            const sandbox = {
              console,
              Math,
              SEC3: {
                PerspProjector: function PerspProjector() {},
              },
              mat4: {
                create() {
                  return {};
                },
                perspective() {},
              },
            };
            sandbox.SEC3.PerspProjector.prototype = {};

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "SpotLight.js" });

            const gl = { tag: "gl" };
            const fakeLight = {
              cascadeFramebuffers: [{}],
              cascadeMatrices: [],
              cascadeClips: [],
              nearResolution: 512,
              fov: 60,
              aspect: 1,
              zNear: 0.6,
              zFar: 30,
              disposeBuffers(glArg) {
                calls.push(["disposeBuffers", glArg]);
                this.cascadeFramebuffers = [];
              },
              addCascade(resolution, near, far) {
                calls.push(["addCascade", resolution, near, far]);
              },
            };

            sandbox.SEC3.SpotLight.prototype.setupCascades.call(fakeLight, 2, 512, gl, {});

            const disposeCall = calls.find((entry) => entry[0] === "disposeBuffers");
            assert.ok(disposeCall, "setupCascades should dispose old cascade buffers before rebuilding them");
            assert.strictEqual(
              disposeCall[1],
              gl,
              "setupCascades should forward the active gl context when disposing old cascade buffers"
            );
            assert.deepStrictEqual(
              calls.filter((entry) => entry[0] === "addCascade"),
              [
                ["addCascade", 512, 0, 0.5],
                ["addCascade", 256, 0.5, 1],
              ],
              "setupCascades should rebuild the requested cascade chain after disposal"
            );
            """
        )

        self._run_node(script)

    def test_spotlight_setup_cascades_passes_gl_through_real_add_cascade(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/SpotLight.js"),
              "utf8"
            );

            const calls = [];
            const sandbox = {
              console,
              Math,
              SEC3: {
                PerspProjector: function PerspProjector() {},
                createFBO() {
                  return {
                    initialize(glArg, width, height, attachmentCount) {
                      calls.push(["initialize", glArg, width, height, attachmentCount]);
                      return true;
                    },
                  };
                },
              },
              mat4: {
                create() {
                  return {};
                },
                perspective() {},
              },
            };
            sandbox.SEC3.PerspProjector.prototype = {};

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "SpotLight.js" });

            const providedGl = { tag: "provided-gl" };
            const light = new sandbox.SEC3.SpotLight(512);
            light.fov = 60;
            light.aspect = 1;
            light.zNear = 0.6;
            light.zFar = 30;
            light.disposeBuffers = function() {
              this.cascadeFramebuffers = [];
            };

            light.setupCascades(1, 512, providedGl, {});

            assert.deepStrictEqual(
              calls,
              [["initialize", providedGl, 512, 512, 1]],
              "setupCascades should pass the explicit gl context through the real addCascade/FBO initialization path"
            );
            """
        )

        self._run_node(script)

    def test_spotlight_setup_cascades_falls_back_to_global_gl_when_explicit_gl_is_omitted(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/SpotLight.js"),
              "utf8"
            );

            const calls = [];
            const globalGl = { tag: "global-gl" };
            const sandbox = {
              console,
              Math,
              gl: globalGl,
              SEC3: {
                PerspProjector: function PerspProjector() {},
                createFBO() {
                  return {
                    initialize(glArg, width, height, attachmentCount) {
                      calls.push(["initialize", glArg, width, height, attachmentCount]);
                      return true;
                    },
                  };
                },
              },
              mat4: {
                create() {
                  return {};
                },
                perspective() {},
              },
            };
            sandbox.SEC3.PerspProjector.prototype = {};

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "SpotLight.js" });

            const light = new sandbox.SEC3.SpotLight(512);
            light.fov = 60;
            light.aspect = 1;
            light.zNear = 0.6;
            light.zFar = 30;
            light.disposeBuffers = function() {
              this.cascadeFramebuffers = [];
            };

            light.setupCascades(1, 512);

            assert.deepStrictEqual(
              calls,
              [["initialize", globalGl, 512, 512, 1]],
              "setupCascades should preserve the legacy global-gl fallback when no explicit gl argument is provided"
            );
            """
        )

        self._run_node(script)

    def test_blur_slider_uses_namespaced_postfx_program(self):
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

            const sliderEntries = [];
            const glCalls = [];
            const sandbox = {
              console,
              Math,
              SEC3: {
                postFx: {
                  blurGaussianProg: {
                    ref() {
                      return "blur-program";
                    },
                    uLilSigLoc: "uLilSig",
                  },
                },
              },
              UI: function UI() {
                return {
                  addSlider(label, callback) {
                    sliderEntries.push([label, callback]);
                  },
                };
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
              },
              gl: {
                useProgram(program) {
                  glCalls.push(["useProgram", program]);
                },
                uniform1f(location, value) {
                  glCalls.push(["uniform1f", location, value]);
                },
              },
            };
            sandbox.window = sandbox;

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "SEC3DEMO.js" });

            sandbox.initBlurButtons();

            const sigmaSlider = sliderEntries.find((entry) => String(entry[0]).startsWith("Sigma: "));
            assert.ok(sigmaSlider, "initBlurButtons should register the blur sigma slider");
            const sliderLabel = sigmaSlider[1]({ target: { value: 3 } });

            assert.deepStrictEqual(
              glCalls,
              [
                ["useProgram", "blur-program"],
                ["uniform1f", "uLilSig", 9],
              ],
              "The blur slider should update SEC3.postFx.blurGaussianProg with sigma squared"
            );
            assert.strictEqual(sliderLabel, "Sigma: 3");
            """
        )

        self._run_node(script)

    def test_dof_sliders_use_namespaced_postfx_program(self):
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

            const sliderEntries = [];
            const glCalls = [];
            const sandbox = {
              console,
              Math,
              SEC3: {
                postFx: {
                  dofDownsampleProg: {
                    ref() {
                      return "dof-program";
                    },
                    uDofEqLoc: "uDofEq",
                  },
                },
              },
              UI: function UI() {
                return {
                  addSlider(label, callback) {
                    sliderEntries.push([label, callback]);
                  },
                };
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
              },
              mat4: {
                create() {
                  return {};
                },
                translate() {},
              },
              gl: {
                useProgram(program) {
                  glCalls.push(["useProgram", program]);
                },
                uniform2fv(location, value) {
                  glCalls.push(["uniform2fv", location, value]);
                },
              },
            };
            sandbox.window = sandbox;

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "SEC3DEMO.js" });

            assert.strictEqual(
              sandbox.demo.secondPass,
              "dofProg",
              "SEC3 demo should default to the DOF second-pass mode so depth-of-field is visible on first load"
            );

            sandbox.initDofButtons();

            const slopeSlider = sliderEntries.find((entry) => String(entry[0]).includes(":Near slope"));
            const interceptSlider = sliderEntries.find((entry) => String(entry[0]).includes(":Near intercept"));
            const passModeSlider = sliderEntries.find((entry) => String(entry[0]).includes(":Render pass"));
            assert.ok(slopeSlider, "initDofButtons should register the near-slope slider");
            assert.ok(interceptSlider, "initDofButtons should register the near-intercept slider");
            assert.ok(passModeSlider, "initDofButtons should register a render-pass mode slider so DOF can be selected from UI");
            assert.ok(
              String(passModeSlider[0]).includes("DOF"),
              "The render-pass slider should initialize in DOF mode to match the startup second-pass default"
            );

            glCalls.length = 0;
            const slopeLabel = slopeSlider[1]({ target: { value: -5 } });
            assert.deepStrictEqual(
              glCalls,
              [
                ["useProgram", "dof-program"],
                ["uniform2fv", "uDofEq", [-5, 2.1]],
              ],
              "The near-slope slider should update SEC3.postFx.dofDownsampleProg with the new DOF equation"
            );
            assert.strictEqual(slopeLabel, "-5 :Near slope");

            glCalls.length = 0;
            const interceptLabel = interceptSlider[1]({ target: { value: 1.5 } });
            assert.deepStrictEqual(
              glCalls,
              [
                ["useProgram", "dof-program"],
                ["uniform2fv", "uDofEq", [-5, 1.5]],
              ],
              "The near-intercept slider should reuse SEC3.postFx.dofDownsampleProg and preserve the updated slope"
            );
            assert.strictEqual(interceptLabel, "1.5 :Near intercept");

            sandbox.demo.secondPass = "bufferRenderProg";
            const passModeLabel = passModeSlider[1]({ target: { value: 3 } });
            assert.strictEqual(
              sandbox.demo.secondPass,
              "dofProg",
              "Selecting render-pass mode 3 from the DOF UI should switch the demo into dofProg without keyboard input"
            );
            assert.ok(
              String(passModeLabel).includes("DOF"),
              "The render-pass slider label should expose that mode 3 maps to DOF"
            );
            """
        )

        self._run_node(script)

    def test_postfx_init_seeds_default_dof_equation_during_async_boot(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const postFxSource = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/postFx.js"),
              "utf8"
            );
            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/demos/SEC3DEMO.js"),
              "utf8"
            );

            const glCalls = [];
            const createdPrograms = [];
            const sandbox = {
              console,
              Math,
              Float32Array,
              Uint16Array,
              SEC3: {
                canvas: {
                  width: 800,
                  height: 600,
                },
                postFx: {},
                resolveResourcePath(assetPath) {
                  return assetPath;
                },
                registerAsyncObj() {},
                createShaderProgram() {
                  const program = {
                    loadShader(...args) {
                      program.shaderPaths = args.filter((value) => typeof value === "string");
                    },
                    ref() {
                      return "dof-program";
                    },
                    addCallback(callback) {
                      program.callback = callback;
                    },
                  };
                  createdPrograms.push(program);
                  return program;
                },
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
              },
              mat4: {
                create() {
                  return {};
                },
                translate() {},
              },
              gl: {
                getAttribLocation() {
                  return 0;
                },
                getUniformLocation(program, name) {
                  return name;
                },
                useProgram(program) {
                  glCalls.push(["useProgram", program]);
                },
                uniform1f(location, value) {
                  glCalls.push(["uniform1f", location, value]);
                },
                uniform2fv(location, value) {
                  glCalls.push(["uniform2fv", location, value]);
                },
              },
            };
            sandbox.window = sandbox;

            vm.createContext(sandbox);
            vm.runInContext(postFxSource, sandbox, { filename: "postFx.js" });
            vm.runInContext(source, sandbox, { filename: "SEC3DEMO.js" });

            sandbox.SEC3.postFx.init();

            const dofProgram = createdPrograms.find(
              (program) =>
                Array.isArray(program.shaderPaths) &&
                program.shaderPaths.some((shaderPath) => shaderPath.includes("dofDownsample.frag"))
            );
            assert.ok(dofProgram && dofProgram.callback, "postFx.init should register the DOF downsample shader callback");

            glCalls.length = 0;
            dofProgram.callback();

            assert.deepStrictEqual(
              glCalls,
              [
                ["useProgram", "dof-program"],
                ["uniform2fv", "u_pixDim", [1 / 800, 1 / 600]],
                ["uniform1f", "u_near", 0.6],
                ["uniform1f", "u_far", 30],
                ["uniform2fv", "u_dofEq", [-9, 2.1]],
              ],
              "postFx.init should seed the DOF shader with the SEC3 demo defaults during async boot"
            );
            """
        )

        self._run_node(script)

    def test_dof_key_selects_second_pass_and_invokes_dof_pipeline(self):
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

            const calls = [];
            const selectedLight = { id: "selected-light" };
            const sandbox = {
              console,
              Math,
              Float32Array,
              Uint16Array,
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
              },
              interactor: {
                onKeyDown(event) {
                  calls.push(["interactor.onKeyDown", event.keyCode]);
                },
              },
              scene: {
                getLight(index) {
                  calls.push(["scene.getLight", index]);
                  return selectedLight;
                },
                getCamera() {
                  return { id: "scene-camera" };
                },
              },
              particleSystem: {
                stepParticles() {
                  calls.push(["particleSystem.stepParticles"]);
                },
                updateShadowMap(light) {
                  calls.push(["particleSystem.updateShadowMap", light]);
                },
                draw(light) {
                  calls.push(["particleSystem.draw", light]);
                },
              },
              SEC3: {
                isWaiting: false,
                canvas: { width: 800, height: 600 },
                renderer: {
                  updateShadowMaps(sceneArg) {
                    calls.push(["renderer.updateShadowMaps", sceneArg]);
                  },
                  fillGPass(gBufferArg, cameraArg) {
                    calls.push(["renderer.fillGPass", gBufferArg, cameraArg]);
                  },
                  deferredRender(sceneArg, gBufferArg, gBufferArg2) {
                    calls.push(["renderer.deferredRender", sceneArg, gBufferArg, gBufferArg2]);
                  },
                },
                postFx: {
                  dofPass() {
                    calls.push(["postFx.dofPass"]);
                  },
                  finalPass(textureArg) {
                    calls.push(["postFx.finalPass", textureArg]);
                  },
                },
              },
              camera: { id: "camera" },
              finalFBO: {
                texture(index) {
                  return "finalFBO.texture(" + index + ")";
                },
              },
              workingFBO: {
                texture(index) {
                  return "workingFBO.texture(" + index + ")";
                },
              },
              lightFBO: { id: "lightFBO" },
              gl: {},
              window: {},
            };
            sandbox.window = sandbox;
            sandbox.SEC3.gBuffer = { id: "gBuffer" };
            sandbox.elCounter = 0;

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "SEC3DEMO.js" });
            sandbox.moveLight = function(light) {
              calls.push(["moveLight", light]);
            };

            sandbox.setKeyInputs();
            sandbox.window.onkeydown({ keyCode: 55 });
            assert.strictEqual(
              sandbox.demo.secondPass,
              "dofProg",
              "Key 7 should switch the SEC3 demo second-pass mode into DOF"
            );
            sandbox.demo.secondPass = "bufferRenderProg";
            sandbox.window.onkeydown({ key: "7", code: "Digit7" });
            assert.strictEqual(
              sandbox.demo.secondPass,
              "dofProg",
              "Modern keyboard events should be able to switch the second pass into DOF without relying on deprecated keyCode"
            );

            calls.length = 0;
            sandbox.myRender();

            assert.deepStrictEqual(
              calls,
              [
                ["particleSystem.stepParticles"],
                ["scene.getLight", 0],
                ["moveLight", selectedLight],
                ["renderer.updateShadowMaps", sandbox.scene],
                ["scene.getLight", 0],
                ["particleSystem.updateShadowMap", selectedLight],
                ["renderer.fillGPass", sandbox.SEC3.gBuffer, { id: "scene-camera" }],
                ["renderer.deferredRender", sandbox.scene, sandbox.SEC3.gBuffer, sandbox.SEC3.gBuffer],
                ["particleSystem.draw", selectedLight],
                ["postFx.dofPass"],
                ["postFx.finalPass", "workingFBO.texture(0)"],
              ],
              "When the second pass is DOF, myRender should execute the DOF pipeline and present workingFBO.texture(0)"
            );
            """
        )

        self._run_node(script)

    def test_cascade_slider_rebuilds_namespaced_renderer_programs(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const webglUtilSource = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/webgl-util.js"),
              "utf8"
            );
            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/demos/SEC3DEMO.js"),
              "utf8"
            );

            const sliderEntries = [];
            const calls = [];
            const pendingTimeouts = [];
            const pendingAnimationFrames = [];
            let renderLoopStarts = 0;
            const gl = {
              tag: "gl",
              asyncObjArray: [
                {
                  isReady() {
                    return true;
                  },
                  executeCallBackFunc() {
                    calls.push(["executeCallBackFunc", "initialBoot"]);
                  },
                },
              ],
            };
            const oldBuildShadowMapProg = {
              dispose(glArg) {
                calls.push(["disposeBuildShadowMapProg", glArg]);
              },
            };
            const oldRenderWithCascadesProg = {
              dispose(glArg) {
                calls.push(["disposeRenderWithCascadesProg", glArg]);
              },
            };
            function createAsyncProgram(name) {
              return {
                name,
                isReady() {
                  return true;
                },
                executeCallBackFunc() {
                  calls.push(["executeCallBackFunc", name]);
                },
              };
            }
            const newBuildShadowMapProg = createAsyncProgram("newBuildShadowMapProg");
            const newRenderWithCascadesProg = createAsyncProgram("newRenderWithCascadesProg");
            const light = {
              nearResolution: 512,
              numCascades: 1,
              setupCascades(cascadeCount, nearResolution, glArg, sceneArg) {
                calls.push(["setupCascades", cascadeCount, nearResolution, glArg, sceneArg]);
              },
            };
            const scene = {
              getLight() {
                return light;
              },
              getNumLights() {
                return 1;
              },
            };

            const sandbox = {
              console,
              Math,
              Float32Array,
              scene,
              gl,
              window: {
                WebGLRenderingContext: function WebGLRenderingContext() {},
                setTimeout(callback, delay, arg) {
                  pendingTimeouts.push([callback, arg]);
                },
              },
              SEC3: {
                ShaderCreator: {
                  buildShadowMapPrograms(glArg, sceneArg) {
                    calls.push(["buildShadowMapPrograms", glArg, sceneArg]);
                    sandbox.SEC3.registerAsyncObj(glArg, newBuildShadowMapProg);
                    return newBuildShadowMapProg;
                  },
                  renderCascShadowProg(glArg, sceneArg) {
                    calls.push(["renderCascShadowProg", glArg, sceneArg]);
                    sandbox.SEC3.registerAsyncObj(glArg, newRenderWithCascadesProg);
                    return newRenderWithCascadesProg;
                  },
                },
                renderer: {
                  buildShadowMapProg: oldBuildShadowMapProg,
                  renderWithCascadesProg: oldRenderWithCascadesProg,
                },
                renderLoop() {
                  renderLoopStarts += 1;
                  sandbox.window.requestAnimationFrame(function noop() {});
                },
              },
              UI: function UI() {
                return {
                  addSlider(label, callback) {
                    sliderEntries.push([label, callback]);
                  },
                };
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
              },
            };
            sandbox.window = sandbox;
            sandbox.requestAnimationFrame = function(callback) {
              pendingAnimationFrames.push(callback);
              return pendingAnimationFrames.length;
            };

            vm.createContext(sandbox);
            vm.runInContext(webglUtilSource, sandbox, { filename: "webgl-util.js" });
            vm.runInContext(source, sandbox, { filename: "SEC3DEMO.js" });

            sandbox.SEC3.isWaiting = true;
            sandbox.SEC3.run(gl);
            assert.strictEqual(renderLoopStarts, 1, "Initial async boot should start the render loop once");
            assert.strictEqual(pendingAnimationFrames.length, 1, "Initial boot should schedule a follow-up animation frame");
            calls.length = 0;

            sandbox.initLightUi();

            const cascadeSlider = sliderEntries.find((entry) => String(entry[0]).includes(":Cascades"));
            assert.ok(cascadeSlider, "initLightUi should register a cascade slider");
            const sliderLabel = cascadeSlider[1]({ target: { value: 3 } });

            let safetyCounter = 0;
            while (pendingTimeouts.length > 0) {
              const [callback, arg] = pendingTimeouts.shift();
              callback(arg);
              safetyCounter += 1;
              assert.ok(safetyCounter < 5, "Cascade slider async processing should settle quickly");
            }

            assert.deepStrictEqual(
              calls,
              [
                ["setupCascades", 3, 512, gl, scene],
                ["disposeBuildShadowMapProg", gl],
                ["buildShadowMapPrograms", gl, scene],
                ["disposeRenderWithCascadesProg", gl],
                ["renderCascShadowProg", gl, scene],
                ["executeCallBackFunc", "newBuildShadowMapProg"],
                ["executeCallBackFunc", "newRenderWithCascadesProg"],
              ],
              "The cascade slider should rebuild the renderer programs and finish async shader setup"
            );
            assert.strictEqual(
              sandbox.SEC3.renderer.buildShadowMapProg,
              newBuildShadowMapProg,
              "The cascade slider should replace SEC3.renderer.buildShadowMapProg with the rebuilt program"
            );
            assert.strictEqual(
              sandbox.SEC3.renderer.renderWithCascadesProg,
              newRenderWithCascadesProg,
              "The cascade slider should replace SEC3.renderer.renderWithCascadesProg with the rebuilt program"
            );
            assert.strictEqual(
              renderLoopStarts,
              1,
              "The cascade slider should not start an extra render loop after initial boot"
            );
            assert.strictEqual(sandbox.SEC3.isWaiting, false);
            assert.ok(Array.isArray(gl.asyncObjArray) && gl.asyncObjArray.length === 0);
            assert.strictEqual(sliderLabel, "3 :Cascades");
            """
        )

        self._run_node(script)


if __name__ == "__main__":
    unittest.main(verbosity=2)
