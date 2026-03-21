import unittest
import urllib.parse
from html.parser import HTMLParser
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


class ScriptSrcParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.script_sources = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "script":
            return
        attrs_dict = dict(attrs)
        src = attrs_dict.get("src")
        if src:
            self.script_sources.append(src)


class EntrypointScriptPathTests(unittest.TestCase):
    def _read_entrypoint_html(self, entrypoint_path):
        entrypoint_file = REPO_ROOT / entrypoint_path.lstrip("/")
        self.assertTrue(entrypoint_file.exists(), f"{entrypoint_path} should exist in the repo")
        return entrypoint_file.read_text(encoding="utf-8", errors="ignore")

    def _resolve_local_script_path(self, entrypoint_path, script_src):
        base_url = f"https://repo.local{entrypoint_path}"
        script_url = urllib.parse.urljoin(base_url, script_src)
        script_path = urllib.parse.urlparse(script_url).path.lstrip("/")
        resolved = (REPO_ROOT / script_path).resolve()
        if not resolved.is_relative_to(REPO_ROOT):
            return None
        return resolved

    def _assert_entrypoint_scripts_fetch(self, entrypoint_path):
        html = self._read_entrypoint_html(entrypoint_path)
        parser = ScriptSrcParser()
        parser.feed(html)

        failures = []
        for script_src in parser.script_sources:
            if script_src.startswith(("http://", "https://", "//")):
                continue
            resolved_path = self._resolve_local_script_path(entrypoint_path, script_src)
            if resolved_path is None or not resolved_path.exists():
                failures.append(script_src)

        self.assertEqual(
            failures,
            [],
            f"{entrypoint_path} should only reference fetchable local scripts: {failures}",
        )

    def test_root_index_references_only_fetchable_scripts(self):
        self._assert_entrypoint_scripts_fetch("/index.html")

    def test_particle_demo_references_only_fetchable_scripts(self):
        self._assert_entrypoint_scripts_fetch("/particleDemo.html")

    def test_sec3index_references_only_fetchable_scripts(self):
        self._assert_entrypoint_scripts_fetch("/Sec3Engine/sec3index.html")


if __name__ == "__main__":
    unittest.main(verbosity=2)
