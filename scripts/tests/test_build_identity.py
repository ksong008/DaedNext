import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_prebuilt_release import hashes, validate_identity, verified_assets
from product_build_identity import product_features


class BuildIdentityTests(unittest.TestCase):
    def test_defaults_and_extra_features_both_reach_identity(self):
        metadata = {"packages": [{"name": "dae-daemon", "features": {
            "default": ["product-api", "allocator-jemalloc", "tls"],
            "tls": ["test-boringssl-tcp-tls", "test-boringssl-quic"],
            "native-ebpf": ["dep:loader"],
        }}]}
        with patch("product_build_identity.subprocess.check_output", return_value=json.dumps(metadata)):
            self.assertEqual(product_features(Path("core"), "native-ebpf"), [
                "native-ebpf", "jemalloc", "bpf-btf", "boringssl-tcp", "boringssl-quic",
            ])
            self.assertNotIn("native-ebpf", product_features(Path("core")))

    def test_old_core_or_ui_cannot_be_packaged_under_current_release(self):
        expected = {"version": "3.2.0-rb83", "core": "abcdef123456", "ui": "fedcba654321",
                    "target": "linux-x86_64-v3", "features": "native-ebpf,jemalloc,bpf-btf,boringssl-tcp,boringssl-quic"}
        def line(fields):
            return "daed rust-native product " + " ".join(f"{k}={v}" for k, v in fields.items())
        validate_identity(line(expected), expected)
        for field in expected:
            with self.subTest(field=field):
                changed = dict(expected, **{field: "outdated"})
                with self.assertRaisesRegex(ValueError, field + " mismatch"):
                    validate_identity(line(changed), expected)

    def test_missing_and_duplicate_identity_are_rejected(self):
        for line in ["daed 3.2.0", "daed rust-native product core=old core=new",
                     "daed rust-native product core", "daed rust-native product core=new"]:
            with self.subTest(line=line), self.assertRaises(ValueError):
                validate_identity(line, {"core": "new", "ui": "current"})

    def test_packaging_checks_release_asset_provenance(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            web = root / "web"
            web.mkdir()
            index = web / "index.html"
            index.write_text("current UI")
            web_receipt = root / "web.json"
            web_receipt.write_text(json.dumps({"ui_head": "current", "web": hashes(web)}))
            geodata = root / "geodata"
            geodata.mkdir()
            (geodata / "geoip.dat").write_text("GeoIP")
            (geodata / "geosite.dat").write_text("GeoSite")
            checksums = root / "geodata.SHA256SUMS"
            checksums.write_text("".join(f"{digest}  {name}\n" for name, digest in hashes(geodata).items()))

            args = (web, geodata, web_receipt, checksums)
            self.assertEqual(verified_assets(*args, "current"), (hashes(web), hashes(geodata)))
            with self.assertRaisesRegex(ValueError, "WebUI"):
                verified_assets(*args, "newer")
            index.write_text("stale UI")
            with self.assertRaisesRegex(ValueError, "WebUI"):
                verified_assets(*args, "current")
            index.write_text("current UI")
            (geodata / "geoip.dat").write_text("different GeoIP")
            with self.assertRaisesRegex(ValueError, "Geo data"):
                verified_assets(*args, "current")


if __name__ == "__main__":
    unittest.main()
