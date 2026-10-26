#!/usr/bin/env bash
# This is a HOST key check, not a user login key.
# The fingerprint was independently confirmed by the owner's Zonetic Hosting
# provider-console screenshot on 26 October 2026. SSH remains strict.
set -euo pipefail
: "${VPS_HOST:?VPS_HOST required}"
: "${VPS_PORT:?VPS_PORT required}"
: "${1:?known_hosts destination required}"
readonly TRUSTED_FINGERPRINT="SHA256:2rrg9Yfj69KWm1VlB6vD2mIH0wklRFItgR5aHAgeMCA"
candidate="$(mktemp)"
trap 'rm -f "$candidate"' EXIT
ssh-keyscan -T 12 -p "$VPS_PORT" -t ed25519 "$VPS_HOST" 2>/dev/null > "$candidate"
# A scan is untrusted until the exact, separately verified key fingerprint matches.
count="$(grep -Ec '^[^#[:space:]]+[[:space:]]+ssh-ed25519[[:space:]]+AAAAC3' "$candidate" || true)"
[ "$count" -eq 1 ] || { echo "SSH_HOST_KEY_COUNT_INVALID" >&2; exit 1; }
actual="$(ssh-keygen -lf "$candidate" -E sha256 | awk 'NR==1 {print $2}')"
[ "$actual" = "$TRUSTED_FINGERPRINT" ] || {
  echo "SSH_HOST_FINGERPRINT_MISMATCH: host is NOT trusted; refusing access." >&2
  exit 1
}
install -m 600 "$candidate" "$1"
echo "SSH_HOST_IDENTITY_VERIFIED=true"
