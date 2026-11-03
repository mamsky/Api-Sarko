#!/usr/bin/env bash
# Deploy SARKO API di VPS. Dijalankan dari /srv/apps/sarko-api.
# Aman diulang (idempotent): build -> migrate -> up -> health check.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$APP_DIR"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
fail() { printf '[GAGAL] %s\n' "$*" >&2; exit 1; }

[ -f .env ] || fail ".env tidak ada di $APP_DIR"
[ -f package.json ] || fail "package.json tidak ada di $APP_DIR"

HOST_DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#@postgres:#@127.0.0.1:#')"
[ -n "$HOST_DATABASE_URL" ] || fail "DATABASE_URL tidak ada di .env"

log "1/6 Bangun @sarko/contracts"
npm --prefix packages/contracts install --no-audit --no-fund
npm --prefix packages/contracts run build
[ -f packages/contracts/dist/index.js ] || fail "packages/contracts/dist/index.js tidak terbentuk"

log "2/6 Install dependency API"
npm install --no-audit --no-fund

log "3/6 Typecheck + test + build"
npm run typecheck
npm test -- --ci --silent
# `nest build` menghapus dist tapi tsc incremental bisa mengira output masih
# up-to-date -> dist/main.js tidak terbentuk. Buang cache-nya.
rm -f tsconfig.tsbuildinfo tsconfig.build.tsbuildinfo
npm run build
[ -f dist/main.js ] || fail "dist/main.js tidak terbentuk"

log "4/6 Migrasi database"
DATABASE_URL="$HOST_DATABASE_URL" npm run db:migrate

log "5/6 Build & jalankan container"
docker compose build
docker compose up -d

log "6/6 Health check"
for i in $(seq 1 30); do
  if curl -fsS -m 5 http://127.0.0.1:4000/v1/health | grep -q '"status":"ok"'; then
    curl -fsS -m 5 http://127.0.0.1:4000/v1/health
    printf '\n'
    log "Deploy sukses"
    exit 0
  fi
  sleep 2
done

docker logs --tail 40 sarko-api || true
fail "health check gagal setelah 60 detik"
