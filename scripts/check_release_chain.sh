#!/usr/bin/env bash
set -euo pipefail

DAE_WING_DIR="${DAE_WING_DIR:-/root/project/dae-wing}"
DAE_DIR="${DAE_DIR:-/root/project/dae}"
DAE_CORE_DIR="$DAE_WING_DIR/dae-core"
DAED_DIR="${DAED_DIR:-$(git rev-parse --show-toplevel)}"
DAED_WING_SUBMODULE_DIR="$DAED_DIR/wing"
DAED_DAE_CORE_SUBMODULE_DIR="$DAED_WING_SUBMODULE_DIR/dae-core"

for dir in "$DAED_DIR" "$DAED_WING_SUBMODULE_DIR" "$DAED_DAE_CORE_SUBMODULE_DIR" "$DAE_WING_DIR" "$DAE_CORE_DIR" "$DAE_DIR"; do
  if [ ! -d "$dir/.git" ] && [ ! -f "$dir/.git" ]; then
    echo "missing git checkout: $dir" >&2
    exit 1
  fi
done

daed_branch="$(git -C "$DAED_DIR" branch --show-current || true)"
wing_branch="$(git -C "$DAE_WING_DIR" branch --show-current || true)"
dae_branch="$(git -C "$DAE_DIR" branch --show-current || true)"
daed_wing_commit="$(git -C "$DAED_WING_SUBMODULE_DIR" rev-parse HEAD)"
daed_dae_core_commit="$(git -C "$DAED_DAE_CORE_SUBMODULE_DIR" rev-parse HEAD)"
wing_head="$(git -C "$DAE_WING_DIR" rev-parse HEAD)"
dae_core_commit="$(git -C "$DAE_CORE_DIR" rev-parse HEAD)"
dae_head="$(git -C "$DAE_DIR" rev-parse HEAD)"
daed_submodule_status="$(git -C "$DAED_DIR" status --short wing || true)"
submodule_status="$(git -C "$DAE_WING_DIR" status --short dae-core || true)"

echo "daed dir: $DAED_DIR"
echo "daed branch: ${daed_branch:-detached}"
echo "daed wing submodule HEAD: $daed_wing_commit"
echo "daed wing/dae-core submodule HEAD: $daed_dae_core_commit"
if [ -n "$daed_submodule_status" ]; then
  echo "daed wing submodule worktree status: $daed_submodule_status"
fi
echo "dae-wing dir: $DAE_WING_DIR"
echo "dae-wing branch: ${wing_branch:-detached}"
echo "dae-wing HEAD: $wing_head"
echo "dae-core submodule HEAD: $dae_core_commit"
if [ -n "$submodule_status" ]; then
  echo "dae-core submodule worktree status: $submodule_status"
fi
echo "dae dir: $DAE_DIR"
echo "dae branch: ${dae_branch:-detached}"
echo "dae HEAD: $dae_head"

if [ "$daed_wing_commit" != "$wing_head" ]; then
  echo "chain parity failed: daed wing submodule does not match local dae-wing HEAD" >&2
  exit 1
fi

if [ "$daed_dae_core_commit" != "$dae_core_commit" ]; then
  echo "chain parity failed: daed nested dae-core submodule does not match local dae-wing dae-core HEAD" >&2
  exit 1
fi

if git -C "$DAE_DIR" merge-base --is-ancestor "$dae_core_commit" "$dae_head"; then
  echo "chain parity: daed wing submodule matches local dae-wing HEAD"
  echo "chain parity: dae-wing dae-core commit is contained in local dae HEAD"
else
  echo "chain parity failed: dae-wing dae-core commit is not contained in local dae HEAD" >&2
  exit 1
fi
