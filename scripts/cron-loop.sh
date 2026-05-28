#!/usr/bin/env sh
# Production cron driver: POST the tick endpoint on an interval.
# Used by the `cron` container in docker-compose.yml.
set -eu

: "${CRON_SECRET:?CRON_SECRET is required}"
TARGET="${CRON_TARGET_URL:-http://web:3000/api/cron/tick}"
INTERVAL="${CRON_INTERVAL_SECONDS:-60}"

echo "[cron] driving $TARGET every ${INTERVAL}s"
while true; do
  if ! curl -sf -X POST "$TARGET" -H "x-cron-secret: $CRON_SECRET"; then
    echo "[cron] tick failed — will retry next interval"
  fi
  echo
  sleep "$INTERVAL"
done
