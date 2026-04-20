#!/bin/bash
set -e

# Start Remotion server in background using tsx (bundled via npm in remotion-reveal/)
cd /app/remotion-reveal
echo "[entrypoint] Starting Remotion server on port ${REMOTION_PORT:-3100}..."
npx tsx src/server.ts > /tmp/remotion.log 2>&1 &
REMOTION_PID=$!

# Wait up to 90s for Remotion server to be ready (first-boot bundling takes time)
cd /app
for i in $(seq 1 90); do
  if curl -sf "http://localhost:${REMOTION_PORT:-3100}/health" > /dev/null 2>&1; then
    echo "[entrypoint] Remotion server ready after ${i}s"
    break
  fi
  if ! kill -0 $REMOTION_PID 2>/dev/null; then
    echo "[entrypoint] Remotion server crashed — tail of log:"
    tail -n 100 /tmp/remotion.log || true
    exit 1
  fi
  sleep 1
done

if ! curl -sf "http://localhost:${REMOTION_PORT:-3100}/health" > /dev/null 2>&1; then
  echo "[entrypoint] Remotion did not become ready in 90s — tail of log:"
  tail -n 100 /tmp/remotion.log || true
  exit 1
fi

trap "kill $REMOTION_PID 2>/dev/null; exit 0" SIGTERM SIGINT

echo "[entrypoint] Starting Python bot..."
exec python main.py
