#!/usr/bin/env bash
set -euo pipefail

DAE_WING_DIR="${DAE_WING_DIR:-/root/project/dae-wing}"
DAE_DIR="${DAE_DIR:-/root/project/dae}"
DAE_CORE_DIR="$DAE_WING_DIR/dae-core"

for dir in "$DAE_WING_DIR" "$DAE_CORE_DIR" "$DAE_DIR"; do
  if [ ! -d "$dir/.git" ] && [ ! -f "$dir/.git" ]; then
    echo "missing git checkout: $dir" >&2
    exit 1
  fi
done

wing_branch="$(git -C "$DAE_WING_DIR" branch --show-current || true)"
dae_branch="$(git -C "$DAE_DIR" branch --show-current || true)"
dae_core_commit="$(git -C "$DAE_CORE_DIR" rev-parse HEAD)"
dae_head="$(git -C "$DAE_DIR" rev-parse HEAD)"
submodule_status="$(git -C "$DAE_WING_DIR" status --short dae-core || true)"

echo "dae-wing dir: $DAE_WING_DIR"
echo "dae-wing branch: ${wing_branch:-detached}"
echo "dae-core submodule HEAD: $dae_core_commit"
if [ -n "$submodule_status" ]; then
  echo "dae-core submodule worktree status: $submodule_status"
fi
echo "dae dir: $DAE_DIR"
echo "dae branch: ${dae_branch:-detached}"
echo "dae HEAD: $dae_head"

if git -C "$DAE_DIR" merge-base --is-ancestor "$dae_core_commit" "$dae_head"; then
  echo "chain parity: dae-wing dae-core commit is contained in local dae HEAD"
else
  echo "chain parity failed: dae-wing dae-core commit is not contained in local dae HEAD" >&2
  exit 1
fi
