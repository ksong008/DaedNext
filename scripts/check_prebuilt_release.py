#!/usr/bin/env python3
"""Build release WebUI assets or verify prebuilt release inputs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from tempfile import NamedTemporaryFile

from product_build_identity import product_features


def output(command, cwd=None):
    return subprocess.check_output(command, cwd=cwd, text=True).strip()


def source_head(repo):
    if output(["git", "status", "--porcelain", "--untracked-files=no"], repo):
        raise ValueError(f"source checkout has uncommitted changes: {repo}")
    return output(["git", "rev-parse", "HEAD"], repo)


def validate_identity(line, expected):
    if not line.startswith("daed rust-native product "):
        raise ValueError("binary lacks a Rust-native product identity")
    fields = {}
    for item in line.removeprefix("daed rust-native product ").split():
        key, separator, value = item.partition("=")
        if not separator or key in fields:
            raise ValueError(f"invalid product identity field: {item}")
        fields[key] = value
    for key, value in expected.items():
        if fields.get(key) != value:
            raise ValueError(
                f"binary {key} mismatch: expected {value}, got {fields.get(key)}"
            )


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def hashes(root):
    return {
        str(p.relative_to(root)): sha256(p)
        for p in sorted(root.rglob("*")) if p.is_file()
    }


def build_web(ui):
    ui_head = source_head(ui)
    receipt = ui / "build/package-sources/web-provenance.json"
    receipt.unlink(missing_ok=True)
    subprocess.run(["make", "dist", "DAED_SKIP_WEB_BUILD="], cwd=ui, check=True)
    if source_head(ui) != ui_head:
        raise ValueError("DaedNext checkout changed during WebUI build")
    receipt.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(mode="w", dir=receipt.parent, delete=False) as file:
        temporary = Path(file.name)
        json.dump({"ui_head": ui_head, "web": hashes(ui / "dist")}, file, indent=2)
        file.write("\n")
    temporary.replace(receipt)


def verified_assets(web_dir, geodata_dir, web_receipt, geo_checksums, ui_head):
    web = hashes(web_dir)
    if "index.html" not in web or (web_dir / "index.html").stat().st_size == 0:
        raise ValueError("WebUI index.html is missing or empty")
    if json.loads(web_receipt.read_text()) != {"ui_head": ui_head, "web": web}:
        raise ValueError("WebUI does not match the current checkout and its build receipt")

    expected_geo = {}
    for line in geo_checksums.read_text().splitlines():
        match = re.fullmatch(r"([0-9a-fA-F]{64}) [ *](geoip\.dat|geosite\.dat)", line)
        if match is None or match[2] in expected_geo:
            raise ValueError(f"invalid Geo checksum entry in {geo_checksums}")
        expected_geo[match[2]] = match[1].lower()
    required_geo = {"geoip.dat", "geosite.dat"}
    if set(expected_geo) != required_geo:
        raise ValueError(f"{geo_checksums} must pin both Geo databases")
    geo = {}
    for name in sorted(required_geo):
        file = geodata_dir / name
        if file.stat().st_size == 0:
            raise ValueError(f"{name} is empty")
        geo[name] = sha256(file)
    if geo != expected_geo:
        raise ValueError("Geo data does not match the selected SHA256 checksums")
    return web, geo


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--release-dir", type=Path)
    mode.add_argument("--build-web", action="store_true")
    parser.add_argument("--core-dir", type=Path)
    parser.add_argument("--web-dir", type=Path)
    parser.add_argument("--geodata-dir", type=Path)
    parser.add_argument("--geodata-checksums", type=Path)
    args = parser.parse_args()
    ui = Path(__file__).resolve().parents[1]
    if args.build_web:
        build_web(ui)
        return
    sources = ui / "build/package-sources"
    core = args.core_dir or os.environ.get("RUST_WORKSPACE") or os.environ.get("DAENEXT_ROOT")
    if not core:
        core = next((p for p in [ui / "DaeNext", ui.parent / "DaeNext", ui.parent.parent / "DaeNext"]
                     if (p / "Cargo.toml").is_file()), None)
    if not core:
        raise ValueError("set RUST_WORKSPACE to the DaeNext source checkout")
    core = Path(core).resolve()
    core_head, ui_head = source_head(core), source_head(ui)
    version = f"{os.environ['PACKAGE_VERSION']}-rb{os.environ['PACKAGE_RELEASE']}"
    labels = ",".join(product_features(core, os.environ.get("RUST_FEATURES", "native-ebpf")))
    web, geodata = verified_assets(
        args.web_dir or ui / "dist", args.geodata_dir or sources / "geodata",
        sources / "web-provenance.json", args.geodata_checksums or sources / "geodata.SHA256SUMS",
        ui_head,
    )
    binaries = {}
    for flavor in ["linux-x86_64-v2", "linux-x86_64-v3", "linux-arm64"]:
        binary = args.release_dir.resolve() / "binaries" / f"daed-{flavor}"
        runner = [os.environ.get("QEMU_AARCH64", "qemu-aarch64")] if flavor == "linux-arm64" else []
        line = output([*runner, str(binary), "--version"])
        validate_identity(line, {
            "version": version, "core": core_head[:12], "ui": ui_head[:12],
            "target": flavor, "features": labels,
        })
        binaries[binary.name] = {"sha256": sha256(binary), "identity": line}
    provenance = {"version": version, "core_head": core_head, "ui_head": ui_head,
                  "binaries": binaries, "web": web, "geodata": geodata}
    (args.release_dir / "source-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"Verified prebuilt release {version}: core={core_head[:12]} ui={ui_head[:12]}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Prebuilt release check failed: {error}") from error
