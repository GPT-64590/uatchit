#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
set -a; source .env; set +a
curl -sf -X POST http://localhost:3000/api/cron/tick -H "x-cron-secret: $CRON_SECRET"
echo
