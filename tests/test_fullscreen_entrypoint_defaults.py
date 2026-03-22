import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class FullscreenEntrypointDefaultsTests(unittest.TestCase):
    def _read(self, relative_path):
        return (REPO_ROOT / relative_path).read_text(encoding="utf-8", errors="ignore")

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
                self.assertIn("overflow: hidden", source, f"{entrypoint} should hide page overflow for fullscreen canvas layout")
                self.assertIn(
                    f'id="{canvas_id}"',
                    source,
                    f"{entrypoint} should retain its expected canvas id while switching to fullscreen defaults",
                )

    def test_demo_scripts_sync_canvas_pixel_size_to_viewport_on_startup(self):
        sec3demo_source = self._read("Sec3Engine/demos/SEC3DEMO.js")
        particle_demo_source = self._read("Sec3Engine/demos/ParticleDemo.js")

        self.assertIn(
            "syncCanvasToWindow",
            sec3demo_source,
            "SEC3DEMO should expose a startup helper to sync canvas pixel size to the viewport",
        )
        self.assertIn(
            "syncCanvasToWindow(canvas);",
            sec3demo_source,
            "SEC3DEMO setup should call syncCanvasToWindow(canvas) before initializing GL state",
        )
        self.assertIn(
            "syncCanvasToWindow",
            particle_demo_source,
            "ParticleDemo should expose a startup helper to sync canvas pixel size to the viewport",
        )
        self.assertIn(
            "syncCanvasToWindow(canvas);",
            particle_demo_source,
            "ParticleDemo startup should call syncCanvasToWindow(canvas) before initializing GL state",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
