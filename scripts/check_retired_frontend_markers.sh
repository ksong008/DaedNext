#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"

if rg -n \
  -e 'GraphQL' \
  -e 'graphql' \
  -e '/graphql' \
  -e '__typename' \
  -e '\bGeneralQuery\b' \
  -e '\bNodesConnection\b' \
  -e '\bConfigsQuery\b' \
  -e '\bGroupsQuery\b' \
  -e '\bNodesQuery\b' \
  -e '\bSubscriptionsQuery\b' \
  -e '\bRoutingsQuery\b' \
  -e '\bDNSsQuery\b' \
  -e '\bUserQuery\b' \
  -e 'createConfig:' \
  -e 'updateConfig:' \
  -e 'createRouting:' \
  -e 'updateRouting:' \
  -e 'createDns:' \
  -e 'updateDns:' \
  -e 'createGroup:' \
  -e 'updateNode:' \
  -e 'ensureDefaultResources:' \
  -e 'updatePassword:' \
  -e 'updateSubscriptionLink:' \
  -e 'updateSubscriptionCron:' \
  -e 'importNodes:' \
  apps/web/src; then
  echo "retired frontend markers detected under apps/web/src"
  exit 1
fi
