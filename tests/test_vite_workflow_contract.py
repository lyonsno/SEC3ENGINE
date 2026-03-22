import json
import subprocess
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ViteWorkflowContractTests(unittest.TestCase):
    def _load_package_json(self):
        package_json_path = REPO_ROOT / "package.json"
        self.assertTrue(
            package_json_path.exists(),
            "A package.json should exist so contributors can use a standard npm-based dev workflow",
        )
        return json.loads(package_json_path.read_text(encoding="utf-8"))

    def _load_vite_config(self):
        vite_config_path = REPO_ROOT / "vite.config.mjs"
        self.assertTrue(
            vite_config_path.exists(),
            "A vite.config.mjs should exist so dev/preview behavior is explicit and reproducible",
        )
        script = """
import config from "./vite.config.mjs";
const loaded = typeof config === "function"
  ? config({ command: "serve", mode: "development" })
  : config;
console.log(JSON.stringify(loaded));
"""
        completed = subprocess.run(
            ["node", "--input-type=module", "-e", script],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            completed.returncode,
            0,
            f"Loading vite.config.mjs via Node should succeed:\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}",
        )
        return json.loads(completed.stdout)

    def test_package_json_exposes_standard_vite_scripts(self):
        package_json = self._load_package_json()
        scripts = package_json.get("scripts", {})

        self.assertIn("dev", scripts, "package.json should define a dev script")
        self.assertIn("dev:open", scripts, "package.json should define a dev:open script for quick browser launch")
        self.assertIn("build", scripts, "package.json should define a build script")
        self.assertIn("preview", scripts, "package.json should define a preview script")
        self.assertIn("smoke", scripts, "package.json should define a smoke script for one-command repo sanity checks")
        self.assertIn(
            "smoke:browser",
            scripts,
            "package.json should define a smoke:browser script for optional browser-backed checks",
        )
        self.assertIn(
            "vite",
            scripts["dev"],
            "The dev script should run Vite so local edits reload quickly during demo tuning",
        )
        self.assertIn(
            "vite --open",
            scripts["dev:open"],
            "The dev:open script should launch Vite and open a demo page automatically",
        )
        self.assertIn(
            "vite build",
            scripts["build"],
            "The build script should run Vite build for static output validation",
        )
        self.assertIn(
            "vite preview",
            scripts["preview"],
            "The preview script should run Vite preview for production-like local checks",
        )
        self.assertIn(
            "python3 -m unittest",
            scripts["smoke"],
            "The smoke script should run the Python test harness in one command",
        )
        self.assertIn(
            "tests.test_entrypoint_script_paths",
            scripts["smoke"],
            "The smoke script should include entrypoint path checks",
        )
        self.assertIn(
            "tests.test_particle_demo_bootstrap",
            scripts["smoke"],
            "The smoke script should include particle demo bootstrap checks",
        )
        self.assertIn(
            "tests.test_vite_workflow_contract",
            scripts["smoke"],
            "The smoke script should include the Vite workflow contract itself",
        )
        self.assertIn(
            "python3 -m unittest",
            scripts["smoke:browser"],
            "The smoke:browser script should run the Python unittest browser harness",
        )
        self.assertIn(
            "tests.test_particle_demo_browser_smoke",
            scripts["smoke:browser"],
            "The smoke:browser script should include the particle demo browser smoke suite",
        )
        self.assertIn(
            "tests.test_sec3demo_browser_smoke",
            scripts["smoke:browser"],
            "The smoke:browser script should include the SEC3 demo browser smoke suite",
        )

        dev_dependencies = package_json.get("devDependencies", {})
        self.assertIn("vite", dev_dependencies, "Vite should be listed as a dev dependency")

    def test_vite_config_declares_multipage_localhost_contract(self):
        config = self._load_vite_config()

        self.assertEqual(
            config.get("appType"),
            "mpa",
            "Vite should be configured as a multi-page app so index.html and particleDemo.html are served directly",
        )

        server = config.get("server", {})
        self.assertEqual(server.get("host"), "127.0.0.1", "The Vite dev server should bind loopback by default")
        self.assertTrue(server.get("strictPort"), "The Vite dev server should fail fast if the configured port is in use")
        self.assertIsInstance(server.get("port"), int, "The Vite dev server port should be an explicit integer value")

        preview = config.get("preview", {})
        self.assertEqual(preview.get("host"), "127.0.0.1", "The Vite preview server should bind loopback by default")
        self.assertTrue(preview.get("strictPort"), "The Vite preview server should fail fast if the configured port is in use")
        self.assertIsInstance(preview.get("port"), int, "The Vite preview server port should be an explicit integer value")

    def test_readme_documents_vite_dev_workflow(self):
        readme_path = REPO_ROOT / "README.md"
        readme = readme_path.read_text(encoding="utf-8")

        self.assertIn("npm install", readme, "README should document installing the Vite dev dependencies")
        self.assertIn("npm run dev", readme, "README should document starting the Vite dev server")
        self.assertIn("npm run dev:open", readme, "README should document the quick open-in-browser dev command")
        self.assertIn("npm run smoke", readme, "README should document the one-command smoke test workflow")
        self.assertIn("npm run smoke:browser", readme, "README should document optional browser-backed smoke checks")
        self.assertIn("127.0.0.1", readme, "README should include loopback URLs for the Vite-served entrypoints")


if __name__ == "__main__":
    unittest.main(verbosity=2)
