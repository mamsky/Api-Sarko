#!/usr/bin/env bash
# Push commit SARKO API ke GitHub memakai Personal Access Token.
#
# Pakai:
#   bash scripts/push-to-github.sh
# lalu tempel token saat diminta (input tidak ditampilkan).
#
# Buat token di: https://github.com/settings/tokens
#   Fine-grained : Repository access -> Api-Sarko, Contents: Read and write
#   Classic      : scope "repo"
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

REPO="github.com/mamsky/Api-Sarko.git"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

printf 'Token GitHub (tidak akan tampil): '
IFS= read -rs TOKEN
printf '\n'

if [ -z "${TOKEN:-}" ]; then
  printf '[GAGAL] token kosong\n' >&2
  exit 1
fi

ORIGINAL_URL="$(git remote get-url origin)"

cleanup() {
  git remote set-url origin "$ORIGINAL_URL"
  unset TOKEN
}
trap cleanup EXIT

git remote set-url origin "https://x-access-token:${TOKEN}@${REPO}"

printf 'Push %s ke %s ...\n' "$BRANCH" "$REPO"
if git push -u origin "$BRANCH"; then
  printf '[OK] push berhasil\n'
else
  printf '[GAGAL] push ditolak. Cek scope token (butuh Contents: Read and write / repo).\n' >&2
  exit 1
fi

printf '\nRemote sekarang:\n'
git ls-remote origin "refs/heads/${BRANCH}" || true
