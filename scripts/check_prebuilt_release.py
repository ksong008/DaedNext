#!/usr/bin/env python3
"""Reject prebuilt release binaries that do not match the source checkouts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess

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


def hashes(root):
    return {
        str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(root.rglob("*")) if p.is_file()
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release-dir", type=Path, required=True)
    parser.add_argument("--core-dir", type=Path)
    args = parser.parse_args()
    ui = Path(__file__).resolve().parents[1]
    core = args.core_dir or os.environ.get("RUST_WORKSPACE") or os.environ.get("DAENEXT_ROOT")
    if not core:
        core = next((p for p in [ui / "DaeNext", ui.parent / "DaeNext", ui.parent.parent / "DaeNext"]
                     if (p / "Cargo.toml").is_file()), None)
    if not core:
        raise ValueError("set RUST_WORKSPACE to the DaeNext source checkout")
    core = Path(core).resolve()
    core_head, ui_head = source_head(core), source_head(ui)
    version = f"{os.environ['PACKAGE_VERSION']}-rb{os.environ['PACKAGE_RELEASE']}"
    labels = ",".join(product_features(core, os.environ.get("RUST_FEATURES", "")))
    binaries = {}
    for flavor in ["linux-x86_64-v2", "linux-x86_64-v3", "linux-arm64"]:
        binary = args.release_dir.resolve() / "binaries" / f"daed-{flavor}"
        runner = [os.environ.get("QEMU_AARCH64", "qemu-aarch64")] if flavor == "linux-arm64" else []
        line = output([*runner, str(binary), "--version"])
        validate_identity(line, {
            "version": version, "core": core_head[:12], "ui": ui_head[:12],
            "target": flavor, "features": labels,
        })
        binaries[binary.name] = {"sha256": hashlib.sha256(binary.read_bytes()).hexdigest(), "identity": line}
    web, geodata = hashes(ui / "dist"), hashes(ui / "build/package-sources/geodata")
    if "index.html" not in web or not {"geoip.dat", "geosite.dat"} <= geodata.keys():
        raise ValueError("current web assets and full geodata are required")
    provenance = {"version": version, "core_head": core_head, "ui_head": ui_head,
                  "binaries": binaries, "web": web, "geodata": geodata}
    (args.release_dir / "source-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"Verified prebuilt release {version}: core={core_head[:12]} ui={ui_head[:12]}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Prebuilt release check failed: {error}") from error
