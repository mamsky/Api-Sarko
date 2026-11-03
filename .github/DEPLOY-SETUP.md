# Setup CI/CD — SARKO API

Panduan mengaktifkan GitHub Actions untuk repo `mamsky/Api-Sarko`.

## 1. Secrets yang wajib diisi

Buka **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Isi | Cara dapat |
|---|---|---|
| `TS_OAUTH_CLIENT_ID` | Client ID OAuth Tailscale | Tailscale admin → Settings → OAuth clients |
| `TS_OAUTH_SECRET` | Secret OAuth Tailscale | idem |
| `VPS_HOST` | `100.105.200.113` | IP tailscale VPS |
| `VPS_USER` | `papoy-work-vps` | user SSH VPS |
| `VPS_SSH_KEY` | isi private key `~/.ssh/id_ed25519` | `cat ~/.ssh/id_ed25519` di laptop |

### Kenapa butuh Tailscale

VPS hanya membuka port 22 di interface tailscale (ufw `allow 22/tcp on tailscale0`),
IP publik `103.147.32.118` tidak menerima SSH. Jadi runner GitHub harus join
tailnet dulu sebelum bisa rsync/ssh.

### Membuat OAuth client Tailscale

1. <https://login.tailscale.com/admin/settings/oauth>
2. **Generate OAuth client**
3. Scopes: **Devices → Write** (perlu untuk daftar device baru)
4. Tags: `tag:ci`
5. Salin Client ID + Secret ke secrets di atas

Lalu izinkan tag itu di ACL (`Access controls`):

```json
{
  "tagOwners": { "tag:ci": ["autogroup:admin"] },
  "acls": [
    { "action": "accept", "src": ["tag:ci"], "dst": ["tag:vps:22"] }
  ]
}
```

Kalau VPS belum punya tag, tambahkan `"tag:vps"` ke `tagOwners` dan tag perangkat
VPS di admin console.

## 2. Alur kerja

```
push ke main
  -> CI (lint, typecheck, test, build, docker build)
  -> kalau CI sukses: Deploy
       -> join tailnet
       -> rsync source ke /srv/apps/sarko-api
       -> ssh bash scripts/deploy.sh
       -> verifikasi https://sarko-api.pasteprosmana.my.id/v1/health
```

Deploy juga bisa dipicu manual: **Actions → CI/CD → Run workflow**.

## 3. Yang TIDAK dikirim ke VPS

`rsync` mengecualikan: `.git/`, `.github/`, `node_modules/`, `dist/`,
`packages/contracts/{node_modules,dist}/`, `coverage/`, `*.tsbuildinfo`,
`.env`, `.env.*`.

`.env` sengaja tidak disentuh — file itu sudah ada di VPS (mode 600) dan berisi
kredensial production.

## 4. Kalau deploy gagal

| Gejala | Sebab | Solusi |
|---|---|---|
| `Secret belum diisi` | secrets kosong | isi 5 secrets di atas |
| `ssh: connect to host ... timed out` | runner tidak di tailnet | cek OAuth client + ACL |
| `Permission denied (publickey)` | key salah | `VPS_SSH_KEY` harus private key yang publiknya ada di `~/.ssh/authorized_keys` VPS |
| `[GAGAL] dist/main.js tidak terbentuk` | cache tsc basi | `deploy.sh` sudah `rm -f *.tsbuildinfo` |
| health check publik gagal | container tidak naik | `ssh vps 'docker logs --tail 100 sarko-api'` |

## 5. Uji lokal sebelum push

```bash
# semua yang dijalankan CI
npm install --no-audit --no-fund
npm --prefix packages/contracts install --no-audit --no-fund
npm --prefix packages/contracts run build
npm run lint
npm run typecheck
npm test -- --ci
rm -f tsconfig.tsbuildinfo tsconfig.build.tsbuildinfo
npm run build
docker build -t sarko-api:local .
```
