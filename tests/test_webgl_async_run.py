import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class WebGLAsyncRunTests(unittest.TestCase):
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
            f"Node webgl-util async-run probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )

    def test_run_starts_render_loop_when_async_work_finishes_initial_boot(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/webgl-util.js"),
              "utf8"
            );

            const calls = [];
            const timeouts = [];
            const sandbox = {
              console,
              Math,
              Float32Array,
              window: {
                WebGLRenderingContext: function WebGLRenderingContext() {},
                setTimeout(...args) {
                  timeouts.push(args);
                },
              },
              SEC3: {
                renderLoop() {
                  calls.push("renderLoop");
                },
              },
            };
            sandbox.window.window = sandbox.window;

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "webgl-util.js" });

            const gl = {
              asyncObjArray: [
                {
                  isReady() {
                    return true;
                  },
                  executeCallBackFunc() {
                    calls.push("executeCallBackFunc");
                  },
                },
              ],
            };

            sandbox.SEC3.isWaiting = true;
            sandbox.SEC3.run(gl);

            assert.deepStrictEqual(
              calls,
              ["executeCallBackFunc", "renderLoop"],
              "SEC3.run should execute ready async callbacks and start the render loop during initial boot"
            );
            assert.strictEqual(sandbox.SEC3.isWaiting, false);
            assert.ok(
              Array.isArray(gl.asyncObjArray) && gl.asyncObjArray.length === 0,
              "SEC3.run should clear the async object queue after initial boot work completes"
            );
            assert.deepStrictEqual(timeouts, []);
            """
        )

        self._run_node(script)

    def test_run_can_start_render_loop_again_for_a_new_boot_cycle(self):
        script = textwrap.dedent(
            r"""
            const assert = require("assert");
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/js/core/webgl-util.js"),
              "utf8"
            );

            const calls = [];
            const timeouts = [];
            const sandbox = {
              console,
              Math,
              Float32Array,
              window: {
                WebGLRenderingContext: function WebGLRenderingContext() {},
                setTimeout(...args) {
                  timeouts.push(args);
                },
              },
              SEC3: {
                renderLoop() {
                  calls.push("renderLoop");
                },
              },
            };
            sandbox.window.window = sandbox.window;

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "webgl-util.js" });

            const gl = {
              asyncObjArray: [
                {
                  isReady() {
                    return true;
                  },
                  executeCallBackFunc() {
                    calls.push("boot1");
                  },
                },
              ],
            };

            sandbox.SEC3.isWaiting = true;
            sandbox.SEC3.run(gl);

            gl.asyncObjArray = [
              {
                isReady() {
                  return true;
                },
                executeCallBackFunc() {
                  calls.push("boot2");
                },
              },
            ];
            sandbox.SEC3.isWaiting = true;
            sandbox.SEC3.run(gl);

            assert.deepStrictEqual(
              calls,
              ["boot1", "renderLoop", "boot2", "renderLoop"],
              "SEC3.run should be able to start the render loop again for a later bootstrap cycle in the same JS runtime"
            );
            assert.strictEqual(sandbox.SEC3.isWaiting, false);
            assert.ok(Array.isArray(gl.asyncObjArray) && gl.asyncObjArray.length === 0);
            assert.deepStrictEqual(timeouts, []);
            """
        )

        self._run_node(script)

if __name__ == "__main__":
    unittest.main(verbosity=2)
