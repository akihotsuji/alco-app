#!/usr/bin/env bash
# Cloud Agent の start。依存は install 済み前提。秘密の値は出力しない。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f package.json ]; then
  echo "alco-app: package.json が無いため start をスキップします"
  exit 0
fi

corepack pnpm exec node --experimental-strip-types --disable-warning=ExperimentalWarning \
  src/ci/ensure-local-dev-vars.ts

corepack pnpm db:migrate:local
