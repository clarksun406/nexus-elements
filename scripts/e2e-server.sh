#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
api_port="${E2E_API_PORT:-3101}"
app_port="${E2E_APP_PORT:-3100}"

PORT="$api_port" HOST=127.0.0.1 STORE=memory LOG_LEVEL=info NODE_ENV=test \
  NEXUS_PUBLISHABLE_KEY=pk_test_nexus_example_key \
  NEXUS_SECRET_KEY=sk_test_nexus_example_secret \
  NEXUS_WEBHOOK_SECRET=whsec_test_nexus_example \
  RATE_LIMIT_MAX=10000 TOKEN_RATE_LIMIT_MAX=10000 \
  node apps/server/dist/index.js &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT

for _ in $(seq 1 50); do
  if curl -sf "http://127.0.0.1:${api_port}/health" >/dev/null; then
    break
  fi
  sleep 0.2
done
curl -sf "http://127.0.0.1:${api_port}/health" >/dev/null

NEXUS_API_TARGET="http://127.0.0.1:${api_port}" pnpm --filter examples exec vite --host 127.0.0.1 --port "$app_port" --strictPort
