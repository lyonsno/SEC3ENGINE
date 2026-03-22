import json
import re
import subprocess
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PARTICLE_DEMO_SOURCE = REPO_ROOT / "Sec3Engine/demos/ParticleDemo.js"
STANDALONE_SHADER_SOURCE = REPO_ROOT / "Sec3Engine/shader/nBodyRenderStandalone.frag"


class ParticleDemoShaderContractTests(unittest.TestCase):
    def _read_slider_bounds_from_runtime_probe(self):
        script = textwrap.dedent(
            r"""
            const fs = require("fs");
            const path = require("path");
            const vm = require("vm");

            const source = fs.readFileSync(
              path.join(process.cwd(), "Sec3Engine/demos/ParticleDemo.js"),
              "utf8"
            );

            const sliderEntries = [];
            const sandbox = {
              console,
              Math,
              SEC3ENGINE: {},
              UI: function UI() {
                return {
                  addButton() {},
                  addSlider(label, callback, value, min, max) {
                    sliderEntries.push({ label, min, max });
                  },
                };
              },
              gl: {
                useProgram() {},
                uniform1f() {},
              },
              mat4: {
                create() {
                  return {};
                },
              },
              requestAnimationFrame() {},
              document: {
                getElementById() {
                  return {};
                },
              },
              window: {},
            };
            sandbox.window = sandbox;
            sandbox.SEC3ENGINE.ui = null;

            vm.createContext(sandbox);
            vm.runInContext(source, sandbox, { filename: "ParticleDemo.js" });

            sandbox.system = {
              maxParticles: 4,
              gravityModifier: 1,
              RGBA: [0, 0, 0, 0.1],
              particleSize: 1,
              luminence: 10,
              scatterMultiply: 1,
              shadowMultiply: 1,
              scale: 1,
              damping: 1,
              activeBodies: 1,
              renderProgram: {
                ref() {
                  return "program";
                },
                uAlpha: "uAlpha",
                uSize: "uSize",
                uLuminence: "uLuminence",
                uScatterMultiply: "uScatterMultiply",
                uShadowMultiply: "uShadowMultiply",
                uScale: "uScale",
              },
              stepProgram: {
                ref() {
                  return "step";
                },
                uGravityModifier: "uGravityModifier",
                uDamping: "uDamping",
                uInteractions: "uInteractions",
              },
              restart() {},
            };

            sandbox.initUiButtons();
            const alphaSlider = sliderEntries.find((entry) => entry.label.includes("Particle transparency:"));
            if (!alphaSlider) {
              throw new Error("Particle transparency slider not found");
            }
            console.log(JSON.stringify({ min: alphaSlider.min, max: alphaSlider.max }));
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
            f"Node particle-demo slider contract probe failed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )
        return json.loads(completed.stdout.strip())

    def _extract_alpha_floor_candidates(self, alpha_expression):
        number = r"([0-9]*\.?[0-9]+)"
        floor_candidates = []

        patterns = [
            rf"max\s*\(\s*uAlpha\s*,\s*{number}\s*\)",
            rf"max\s*\(\s*{number}\s*,\s*uAlpha\s*\)",
            rf"clamp\s*\(\s*uAlpha\s*,\s*{number}\s*,",
            rf"uAlpha\s*<\s*{number}\s*\?\s*{number}\s*:\s*uAlpha",
            rf"uAlpha\s*>\s*{number}\s*\?\s*uAlpha\s*:\s*{number}",
            rf"{number}\s*>\s*uAlpha\s*\?\s*{number}\s*:\s*uAlpha",
            rf"{number}\s*<\s*uAlpha\s*\?\s*uAlpha\s*:\s*{number}",
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, alpha_expression):
                groups = [float(value) for value in match.groups()]
                floor_candidates.append(min(groups))

        return floor_candidates

    def test_standalone_shader_does_not_floor_alpha_above_slider_minimum(self):
        slider_bounds = self._read_slider_bounds_from_runtime_probe()
        slider_min = float(slider_bounds["min"])
        shader_source = STANDALONE_SHADER_SOURCE.read_text()

        alpha_assignment = re.search(r"float\s+alpha\s*=\s*([^;]+);", shader_source)
        self.assertIsNotNone(
            alpha_assignment,
            "The standalone particle shader should compute an alpha expression for the transparency slider contract",
        )
        alpha_expression = alpha_assignment.group(1)
        self.assertIn(
            "uAlpha",
            alpha_expression,
            "The standalone particle shader should derive particle alpha from the transparency slider uniform",
        )

        floor_candidates = self._extract_alpha_floor_candidates(alpha_expression)
        if floor_candidates:
            highest_floor = max(floor_candidates)
            self.assertLessEqual(
                highest_floor,
                slider_min,
                (
                    "The standalone particle shader should not clamp alpha above the transparency slider's documented minimum; "
                    f"slider minimum={slider_min}, detected floor candidates={floor_candidates}"
                ),
            )
            return

        # Guard against blind spots: if the expression uses comparison/ternary logic with uAlpha
        # but no known floor form, force an explicit test update instead of silently passing.
        unknown_floor_form = re.search(r"(uAlpha\s*[<>]|[<>]\s*uAlpha|\?)", alpha_expression)
        self.assertIsNone(
            unknown_floor_form,
            (
                "Could not infer alpha-floor semantics from a comparison-based expression. "
                f"Please update the contract parser for expression: {alpha_expression}"
            ),
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
