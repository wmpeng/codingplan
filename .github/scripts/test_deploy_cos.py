import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from deploy_cos import cleanup, public_key, retired_keys, stage_public


class DeploymentTests(unittest.TestCase):
    def test_unsafe_targets_are_rejected(self):
        for key in ["", "/", "-r", "--versions", "/index.html", "../index.html", "v1/../index.html", "v1/", "v1/*", ".git/config", "dev/index.html", "v1\\index.html", "v1//index.html", "v1/index.html\n"]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                public_key(key)

    def test_manifest_validates_entire_list_and_preserves_restored_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = root / "manifest.json"
            (root / "restored.html").write_text("live")
            manifest.write_text(json.dumps(["v1/index.html", "restored.html"]))
            self.assertEqual(retired_keys(root, manifest), ["v1/index.html"])
            for keys in [["v1/index.html", "../secret"], ["v1/index.html"] * 2, {"files": []}]:
                manifest.write_text(json.dumps(keys))
                with self.assertRaises(ValueError):
                    retired_keys(root, manifest)

    def test_cleanup_uses_exact_keys_and_stops_on_failure(self):
        error = subprocess.CalledProcessError(1, "coscmd")
        with patch("deploy_cos.subprocess.run", side_effect=[None, error]) as run:
            with self.assertRaises(subprocess.CalledProcessError):
                cleanup(["v1/index.html", "v1/path with spaces.png", "v2/index.html"])
            self.assertEqual(run.call_args_list[0].args[0], ["coscmd", "delete", "-f", "v1/index.html"])
            self.assertEqual(run.call_args_list[1].args[0], ["coscmd", "delete", "-f", "v1/path with spaces.png"])
            self.assertEqual(run.call_count, 2)

    def test_stage_excludes_internal_and_untracked_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "repo"
            root.mkdir()
            for key in ["index.html", ".github/workflows/test.yml", "dev/index.html", "assets/.private", "untracked.env"]:
                file = root / key
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(key)
            tracked = b"index.html\0.github/workflows/test.yml\0dev/index.html\0assets/.private\0"
            stage = Path(tmp) / "dist"
            with patch("deploy_cos.subprocess.check_output", return_value=tracked):
                self.assertEqual(stage_public(stage, root), 1)
            self.assertEqual([p.name for p in stage.rglob("*")], ["index.html"])
            with self.assertRaises(ValueError):
                stage_public(root / "dist", root)


if __name__ == "__main__":
    unittest.main()
