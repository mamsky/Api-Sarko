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
API="https://api.github.com/repos/mamsky/Api-Sarko"
OWNER="mamsky"
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

# ---------------------------------------------------------------- pra-cek token
# 403 "Permission to X denied to X" artinya token VALID tapi tidak punya izin
# tulis -- bukan token salah. Dua kasus ini butuh perbaikan berbeda, jadi
# dibedakan sebelum push supaya pesan errornya menunjuk penyebab yang benar.
printf 'Cek token ...\n'

AUTH="Authorization: Bearer ${TOKEN}"
ACCEPT="Accept: application/vnd.github+json"

gh_get() {
  # $1 = url. Cetak body, kembalikan HTTP code lewat stdout baris terakhir.
  curl -sS -m 15 -H "$AUTH" -H "$ACCEPT" -w '\n%{http_code}' "$1" 2>/dev/null || true
}

# 1. Token valid? Milik siapa?
ME="$(gh_get https://api.github.com/user)"
ME_CODE="$(printf '%s' "$ME" | tail -n1)"
ME_BODY="$(printf '%s' "$ME" | sed '$d')"

if [ "$ME_CODE" != "200" ]; then
  printf '[GAGAL] token tidak valid atau kedaluwarsa (HTTP %s).\n' "$ME_CODE" >&2
  printf '        Buat token baru di https://github.com/settings/tokens\n' >&2
  exit 1
fi

ME_LOGIN="$(printf '%s' "$ME_BODY" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("login",""))' 2>/dev/null || true)"
printf '  akun        : %s\n' "${ME_LOGIN:-?}"

if [ -n "${ME_LOGIN:-}" ] && [ "$ME_LOGIN" != "$OWNER" ]; then
  printf '\n[GAGAL] token milik "%s", bukan "%s".\n' "$ME_LOGIN" "$OWNER" >&2
  printf '        Hanya pemilik repo (atau collaborator) yang bisa push.\n' >&2
  exit 1
fi

# 2. Punya izin tulis ke repo ini?
R="$(gh_get "$API")"
R_CODE="$(printf '%s' "$R" | tail -n1)"
R_BODY="$(printf '%s' "$R" | sed '$d')"

if [ "$R_CODE" != "200" ]; then
  printf '\n[GAGAL] repo tidak bisa diakses dengan token ini (HTTP %s).\n' "$R_CODE" >&2
  printf '        Untuk fine-grained token, pastikan repo Api-Sarko dipilih\n' >&2
  printf '        di "Repository access".\n' >&2
  exit 1
fi

CAN_PUSH="$(printf '%s' "$R_BODY" | python3 -c '
import json, sys
d = json.load(sys.stdin)
p = d.get("permissions") or {}
print("yes" if p.get("push") else "no")
' 2>/dev/null || echo no)"

printf '  izin push   : %s\n' "$CAN_PUSH"

if [ "$CAN_PUSH" != "yes" ]; then
  printf '\n[GAGAL] Token valid tapi TIDAK punya izin tulis ke repo ini.\n' >&2
  printf '        Inilah sebab 403 "Permission denied" tadi.\n\n' >&2
  printf '  A. Fine-grained token (disarankan)\n' >&2
  printf '     https://github.com/settings/personal-access-tokens/new\n' >&2
  printf '     - Repository access  -> Only select repositories -> Api-Sarko\n' >&2
  printf '     - Permissions        -> Repository permissions\n' >&2
  printf '                             Contents -> Read and write\n' >&2
  printf '     - Generate, salin token berawalan github_pat_\n\n' >&2
  printf '  B. Classic token\n' >&2
  printf '     https://github.com/settings/tokens/new\n' >&2
  printf '     - Centang scope "repo" (grup utuh, bukan hanya repo:status)\n' >&2
  printf '     - Generate, salin token berawalan ghp_\n\n' >&2
  printf '  C. Periksa token yang sedang dipakai\n' >&2
  printf '     curl -s -H "Authorization: Bearer <TOKEN>" %s\n' "$API" >&2
  printf '     -> cari blok "permissions": {"push": true}\n\n' >&2
  printf '  Catatan: token fine-grained yang dibuat SEBELUM repo ada, atau\n' >&2
  printf '  yang tidak mencentang Contents, akan selalu read-only.\n' >&2
  exit 1
fi

# ---------------------------------------------------------------------- push
git remote set-url origin "https://x-access-token:${TOKEN}@${REPO}"

printf '\nPush %s ke %s ...\n' "$BRANCH" "$REPO"
if git push -u origin "$BRANCH"; then
  printf '[OK] push berhasil\n'
else
  printf '\n[GAGAL] push ditolak meski token punya izin push.\n' >&2
  printf '        Kemungkinan branch protection / ruleset.\n' >&2
  printf '        Cek: https://github.com/%s/Api-Sarko/settings/branches\n' "$OWNER" >&2
  exit 1
fi

printf '\nRemote sekarang:\n'
git ls-remote origin "refs/heads/${BRANCH}" || true
