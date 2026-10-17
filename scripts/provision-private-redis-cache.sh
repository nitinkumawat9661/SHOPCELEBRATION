#!/usr/bin/env bash
# Idempotent, isolated cache-only Redis. Run as unprivileged Celebration
# runtime user during the existing vetted VPS deployment workflow.
set -euo pipefail
APP_ROOT="/var/www/celebration"
PRIVATE_ENV="$APP_ROOT/shared/.env.production"
CACHE_DIR="$APP_ROOT/shared/redis-cache"
PORT=6390

test "$(id -un)" = "nitin"
test -f "$PRIVATE_ENV" && test -w "$PRIVATE_ENV"
test -d "$APP_ROOT/shared"

# Preserve owner-managed Redis configurations. Our own dedicated cache URL
# may already be set from a past release; still restart its daemon if needed.
CONFIGURED_REDIS="$(grep '^CELEBRATION_REDIS_URL=' "$PRIVATE_ENV" | tail -1 | cut -d= -f2- || true)"
if [ -n "$CONFIGURED_REDIS" ] &&
    [ "$CONFIGURED_REDIS" != "redis://127.0.0.1:6390/0" ]; then
  echo "CELEBRATION_REDIS_STATUS=OWNER_CONFIGURED; private URL preserved"
  exit 0
fi

# An already-working loopback Redis instance needs no provisioning when
# the owner has not previously chosen the dedicated Celebration cache.
if [ -z "$CONFIGURED_REDIS" ] && command -v redis-cli >/dev/null 2>&1 &&
    timeout 2 redis-cli -h 127.0.0.1 -p 6379 PING 2>/dev/null | grep -Fxq PONG; then
  echo "CELEBRATION_REDIS_STATUS=ACTIVE; using existing private localhost service"
  exit 0
fi

# Prefer preinstalled binaries. If absent, a passwordless sudo APT install
# may be used. Otherwise unpack signed distro APT packages only inside the
# owner-writable shared cache directory. Never change another tenant's Redis.
install -d -m 700 "$CACHE_DIR"
REDIS_SERVER_BIN="$(command -v redis-server || true)"
REDIS_CLI_BIN="$(command -v redis-cli || true)"
if [ -z "$REDIS_SERVER_BIN" ] && command -v sudo >/dev/null 2>&1 &&
    sudo -n true 2>/dev/null && command -v apt-get >/dev/null 2>&1; then
  echo "Redis absent; checking bounded noninteractive system installation"
  if timeout 100 sudo -n apt-get update -qq >/dev/null 2>&1 &&
      timeout 120 sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq redis-server redis-tools >/dev/null 2>&1; then
    REDIS_SERVER_BIN="$(command -v redis-server || true)"
    REDIS_CLI_BIN="$(command -v redis-cli || true)"
  fi
fi

# User-space extraction uses packages matched to the VPS distro/architecture.
if [ -z "$REDIS_SERVER_BIN" ] || [ -z "$REDIS_CLI_BIN" ]; then
  if command -v apt-get >/dev/null 2>&1 && command -v dpkg-deb >/dev/null 2>&1; then
    echo "Redis unavailable system-wide; trying private distro-package extraction"
    PACKAGE_DIR="$CACHE_DIR/packages"
    RUNTIME_DIR="$CACHE_DIR/runtime"
    install -d -m 700 "$PACKAGE_DIR" "$RUNTIME_DIR"
    if ( cd "$PACKAGE_DIR" && timeout 90 apt-get download redis-server redis-tools >/dev/null 2>&1 ); then
      for deb in "$PACKAGE_DIR"/*.deb; do
        [ -f "$deb" ] || continue
        dpkg-deb -x "$deb" "$RUNTIME_DIR"
      done
      REDIS_SERVER_BIN="$RUNTIME_DIR/usr/bin/redis-server"
      REDIS_CLI_BIN="$RUNTIME_DIR/usr/bin/redis-cli"
      export LD_LIBRARY_PATH="$RUNTIME_DIR/lib/x86_64-linux-gnu:$RUNTIME_DIR/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
      if ! "$REDIS_SERVER_BIN" --version >/dev/null 2>&1 ||
          ! "$REDIS_CLI_BIN" --version >/dev/null 2>&1; then
        # Redis may additionally depend on libjemalloc and liblzf.
        ( cd "$PACKAGE_DIR" && timeout 75 apt-get download libjemalloc2 liblzf1 >/dev/null 2>&1 ) || true
        for deb in "$PACKAGE_DIR"/libjemalloc2_*.deb "$PACKAGE_DIR"/liblzf1_*.deb; do
          [ -f "$deb" ] || continue
          dpkg-deb -x "$deb" "$RUNTIME_DIR"
        done
      fi
    fi
  fi
fi

if [ -z "$REDIS_SERVER_BIN" ] || [ -z "$REDIS_CLI_BIN" ] ||
    [ ! -x "$REDIS_SERVER_BIN" ] || [ ! -x "$REDIS_CLI_BIN" ] ||
    ! "$REDIS_SERVER_BIN" --version >/dev/null 2>&1 ||
    ! "$REDIS_CLI_BIN" --version >/dev/null 2>&1; then
  echo "CELEBRATION_REDIS_STATUS=UNAVAILABLE; local Redis binaries not usable"
  exit 0
fi

# Never hijack an existing service on the dedicated port.
if timeout 2 "$REDIS_CLI_BIN" -h 127.0.0.1 -p "$PORT" PING 2>/dev/null | grep -Fxq PONG; then
  if [ ! -f "$CACHE_DIR/redis.pid" ]; then
    echo "CELEBRATION_REDIS_STATUS=UNAVAILABLE; port $PORT is already owned by an unknown Redis"
    exit 0
  fi
elif timeout 1 bash -c 'exec 7<>/dev/tcp/127.0.0.1/6390' 2>/dev/null; then
  echo "CELEBRATION_REDIS_STATUS=UNAVAILABLE; port $PORT is already occupied"
  exit 0
else
  echo "Starting private, non-persistent, localhost-only Redis on $PORT"
  "$REDIS_SERVER_BIN" \
    --bind 127.0.0.1 \
    --port "$PORT" \
    --protected-mode yes \
    --daemonize yes \
    --save "" \
    --appendonly no \
    --maxmemory 64mb \
    --maxmemory-policy allkeys-lru \
    --pidfile "$CACHE_DIR/redis.pid" \
    --logfile "$CACHE_DIR/redis.log" \
    --dir "$CACHE_DIR" >/dev/null 2>&1 || {
      echo "CELEBRATION_REDIS_STATUS=UNAVAILABLE; unable to start private Redis"
      exit 0
    }
fi

READY=false
for attempt in 1 2 3 4 5; do
  if timeout 2 "$REDIS_CLI_BIN" -h 127.0.0.1 -p "$PORT" PING 2>/dev/null | grep -Fxq PONG; then
    READY=true
    break
  fi
  sleep 1
done

if [ "$READY" != "true" ]; then
  echo "CELEBRATION_REDIS_STATUS=UNAVAILABLE; private Redis did not respond"
  exit 0
fi

# Add only the non-secret loopback URL after healthy PING. Do not rewrite the
# owner's existing private credentials or other environment variables.
if ! grep -q '^CELEBRATION_REDIS_URL=' "$PRIVATE_ENV"; then
  printf '\nCELEBRATION_REDIS_URL=redis://127.0.0.1:%s/0\n' "$PORT" >> "$PRIVATE_ENV"
  chmod 600 "$PRIVATE_ENV"
fi
echo "CELEBRATION_REDIS_STATUS=ACTIVE; isolated cache-only Redis PING passed"
