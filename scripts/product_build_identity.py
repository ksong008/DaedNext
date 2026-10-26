#!/usr/bin/env python3
"""Describe the daemon features selected by the checked-out core workspace."""
import argparse
import json
from pathlib import Path
import re
import subprocess


def product_features(core, extra=""):
    metadata = json.loads(subprocess.check_output([
        "cargo", "metadata", "--locked", "--no-deps", "--format-version", "1",
        "--manifest-path", str(Path(core) / "Cargo.toml"),
    ], text=True))
    features = next(p["features"] for p in metadata["packages"] if p["name"] == "dae-daemon")
    pending = ["default", *filter(None, re.split(r"[,\s]+", extra))]
    enabled = set()
    while pending:
        name = pending.pop()
        if name in enabled:
            continue
        enabled.add(name)
        pending.extend(features.get(name, []))
    labels = []
    for feature, label in [
        ("native-ebpf", "native-ebpf"),
        ("allocator-jemalloc", "jemalloc"),
        ("native-ebpf", "bpf-btf"),
        ("test-boringssl-tcp-tls", "boringssl-tcp"),
        ("test-boringssl-quic", "boringssl-quic"),
        ("allocator-system", "allocator-system"),
    ]:
        if feature in enabled:
            labels.append(label)
    return labels


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("core", type=Path)
    parser.add_argument("--features", default="")
    args = parser.parse_args()
    print(",".join(product_features(args.core, args.features)))
