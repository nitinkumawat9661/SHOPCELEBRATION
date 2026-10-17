#!/usr/bin/env bash
# Celebration Admin V3: READ-ONLY staging VPS capability audit.
# NEVER reads env files, keys, customer records, database contents or service logs.
# No sudo is invoked and no files, processes or server configuration are changed.
set -u

ok() { printf '%-28s %s\n' "$1" "$2"; }
exists() { if command -v "$1" >/dev/null 2>&1; then printf yes; else printf no; fi; }
version() {
  case "$1" in
    node|npm) if command -v "$1" >/dev/null 2>&1; then "$1" --version 2>/dev/null | head -n 1; else printf missing; fi ;;
    *) printf unknown ;;
  esac
}
listen() {
  if ! command -v ss >/dev/null 2>&1; then printf unknown; return; fi
  if ss -H -ltn 2>/dev/null | awk -v p=":$1" '$4 ~ (p "$") {found=1} END {exit !found}'; then
    printf in-use
  else
    printf available
  fi
}
has_dir() {
  if [ -d "$1" ]; then printf present; else printf absent; fi
}
can_write() {
  if [ -w "$1" ]; then printf yes; else printf no; fi
}
printf 'CELEBRATION_ADMIN_V3_STAGING_READ_ONLY_AUDIT_V1\n'
ok "timestamp_utc" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ok "os" "$(uname -s 2>/dev/null || printf unknown)"
ok "architecture" "$(uname -m 2>/dev/null || printf unknown)"
ok "login_user" "$(id -un)"
ok "node_version" "$(version node)"
ok "npm_version" "$(version npm)"
for bin in git nginx pm2 psql pg_isready certbot ss curl; do
  ok "installed_${bin}" "$(exists "$bin")"
done
ok "postgreSQL_loopback_5432" "$(if command -v pg_isready >/dev/null 2>&1; then pg_isready -h 127.0.0.1 -p 5432 -t 2 >/dev/null 2>&1 && printf reachable || printf unavailable; else printf unknown; fi)"
ok "production_port_3040" "$(listen 3040)"
ok "candidate_staging_port_3055" "$(listen 3055)"
ok "nginx_site_dir" "$(has_dir /etc/nginx/sites-available)"
ok "celebration_root" "$(has_dir /var/www/celebration)"
ok "proposed_staging_root" "$(has_dir /var/www/celebration-v3-staging)"
ok "var_www_writable" "$(can_write /var/www)"
if command -v sudo >/dev/null 2>&1; then
  if sudo -n -v >/dev/null 2>&1; then
    ok "noninteractive_sudo" yes
  else
    ok "noninteractive_sudo" no
  fi
else
  ok "noninteractive_sudo" unavailable
fi
if command -v df >/dev/null 2>&1; then
  ok "root_free_kib" "$(df -Pk / 2>/dev/null | awk 'NR==2 {print $4}')"
fi
if command -v free >/dev/null 2>&1; then
  ok "available_memory_mib" "$(free -m 2>/dev/null | awk '$1=="Mem:" {print $7}')"
fi
printf 'READ_ONLY_COMPLETE: no deployment, no credential or database access attempted.\n'
