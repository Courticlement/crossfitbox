#!/bin/bash
# Resets one Admin account's password on the preview database.
# Usage: ./_tmp-reset-preview-pw.sh <email> <new-password>
set -euo pipefail
cd "$(dirname "$0")"

EMAIL="$1"
NEW_PASSWORD="$2"
DB_ID="db_zoi6criu2zt9bk5uh4rtihqg"
PROJECT="crossfitbox-preview-v2"

set -a
source <(grep -E '^(PRISMA_SERVICE_TOKEN|PRISMA_WORKSPACE_ID)=' .env)
set +a

echo "Minting scoped connection to $DB_ID ($PROJECT)..."
CONN_JSON=$(bunx @prisma/cli@latest postgres connection create "$DB_ID" --project "$PROJECT" --name reset-admin-pw --json)
CONN_ID=$(echo "$CONN_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['envelope']['result']['connection']['id'])")
CONN_URL=$(echo "$CONN_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['envelope']['result']['connectionString'])")

cleanup() {
  echo "Deleting temporary connection $CONN_ID..."
  bunx @prisma/cli@latest postgres connection delete "$CONN_ID" --confirm "$CONN_ID" > /dev/null
}
trap cleanup EXIT

node _tmp-reset-superadmin.mjs "$CONN_URL" "$EMAIL" "$NEW_PASSWORD"
echo "Done."
