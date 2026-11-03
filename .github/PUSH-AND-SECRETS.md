# Push & Aktifkan CI/CD

Dua langkah: **push kode** lalu **isi secrets**. CI/CD baru jalan setelah keduanya.

## 1. Push kode

Commit `e485a51` sudah siap di `/srv/apps/sarko-api` (146 file, `main` ahead 1).
Repo GitHub masih `b02c4ca` (versi lama yang tidak bisa di-build).

Pilih satu cara.

### Cara A — skrip di VPS (paling cepat)

```bash
ssh vps
cd /srv/apps/sarko-api
bash scripts/push-to-github.sh
```

Skrip minta token, push, lalu mengembalikan URL remote ke semula sehingga token
tidak tertinggal di `.git/config`. Input token tidak ditampilkan di layar.

Buat token di <https://github.com/settings/tokens>:

| Jenis | Yang dicentang |
|---|---|
| Fine-grained | Repository access → `Api-Sarko`; Permissions → Contents: **Read and write** |
| Classic | scope `repo` |

### Cara B — manual dengan token

```bash
ssh vps
cd /srv/apps/sarko-api
git remote set-url origin https://<TOKEN>@github.com/mamsky/Api-Sarko.git
git push -u origin main
git remote set-url origin https://github.com/mamsky/Api-Sarko.git
```

Baris terakhir penting: mengembalikan remote supaya token tidak tersimpan di
`.git/config`.

### Cara C — dari laptop

```bash
cd /d/belajar/belajar/sarko/apps/api
git pull                                  # ambil commit dari VPS? tidak bisa, beda repo
```

Cara C **tidak dianjurkan**: repo di laptop (`b02c4ca`) tidak punya commit
`e485a51`. Kalau ingin lewat laptop, ambil dulu isi repo dari VPS:

```bash
# di VPS
cd /srv/apps/sarko-api && git bundle create /tmp/sarko.bundle main
# di laptop
scp vps:/tmp/sarko.bundle /tmp/
cd /d/belajar/belajar/sarko/apps/api
git pull /tmp/sarko.bundle main
git push origin main
```

### Verifikasi push berhasil

```bash
ssh vps 'cd /srv/apps/sarko-api && git ls-remote origin refs/heads/main'
```

Harus menampilkan hash `e485a51...`, bukan `b02c4ca...`.

## 2. Isi secrets

Buka **Settings → Secrets and variables → Actions → New repository secret**.

| Nama | Nilai |
|---|---|
| `TS_OAUTH_CLIENT_ID` | Client ID OAuth client Tailscale |
| `TS_OAUTH_SECRET` | Secret OAuth client Tailscale |
| `VPS_HOST` | `100.105.200.113` |
| `VPS_USER` | `papoy-work-vps` |
| `VPS_SSH_KEY` | isi penuh `C:\Users\paste\.ssh\id_ed25519` (termasuk baris `-----BEGIN` dan `-----END`) |

### Kenapa butuh Tailscale

VPS hanya menerima SSH lewat tailnet:

```
ufw: hanya 22/tcp di tailscale0
sshd: PasswordAuthentication no, PermitRootLogin no
IP publik VPS: 103.147.32.118 (tidak menerima SSH)
```

Runner GitHub tidak berada di tailnet, jadi harus join dulu. Karena itu
job `deploy` di `ci-cd.yml` memakai `tailscale/github-action`.

### Membuat OAuth client Tailscale

1. <https://login.tailscale.com/admin/settings/oauth>
2. **Generate OAuth client**
3. Scopes: **Devices → Write** (perlu untuk membuat device ephemeral)
4. Tags: `tag:ci`
5. Simpan Client ID + Secret ke secrets di atas

Tambahkan ke ACL policy agar `tag:ci` bisa mencapai VPS:

```json
{
  "tagOwners": {
    "tag:ci": ["autogroup:admin"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["tag:ci"],
      "dst": ["tag:server:22"]
    }
  ]
}
```

Sesuaikan `tag:server` dengan tag yang dipakai VPS Anda. Cek dengan:

```bash
ssh vps 'tailscale status --json | python3 -c "import json,sys; print(json.load(sys.stdin)[\"Self\"][\"Tags\"])"'
```

Kalau VPS tidak memakai tag, ganti `dst` menjadi
`["100.105.200.113:22"]`.

## 3. Uji

### CI

Push ke `main` atau buka PR → tab **Actions** → workflow **CI**.
Harus hijau di dua job: `verify` dan `docker`.

Bisa juga manual: **Actions → CI → Run workflow**.

### Deploy

Deploy berjalan otomatis setelah CI sukses di `main`
(trigger `workflow_run`). Atau manual: **Actions → Deploy → Run workflow**.

Yang dilakukan job `deploy` di `ci-cd.yml`:

1. checkout kode
2. cek 5 secrets terisi (gagal cepat dengan pesan jelas kalau kosong)
3. join tailnet
4. siapkan SSH key
5. `rsync` source ke `/srv/apps/sarko-api` (kecuali `.env`, `node_modules`, `dist`)
6. jalankan `scripts/deploy.sh` di VPS
7. verifikasi `https://sarko-api.pasteprosmana.my.id/v1/health`

## Yang tidak dikirim rsync

`.env` (kredensial tetap di VPS), `node_modules`, `dist`, `packages/contracts/dist`,
`coverage`, `*.tsbuildinfo`, `.git`, `.github`.

## Troubleshooting

| Gejala | Sebab | Solusi |
|---|---|---|
| `could not read Username for 'https://github.com'` | tidak ada kredensial | pakai Cara A atau B |
| `remote: Permission to ... denied` | token kurang scope | buat ulang token dengan Contents: Read and write |
| Deploy gagal di step "Cek secrets" | secret belum diisi | isi 5 secrets di atas |
| `tailscale: ping VPS_HOST failed` | ACL belum izinkan `tag:ci` | perbaiki ACL policy |
| `Permission denied (publickey)` | `VPS_SSH_KEY` salah/terpotong | tempel ulang isi file penuh |
| `rsync: command not found` | rsync tidak ada di VPS | `sudo apt install -y rsync` (sudah terpasang 3.2.7) |
| Deploy jalan tapi kode tidak berubah | rsync terblokir / path salah | cek `APP_DIR` di `ci-cd.yml` = `/srv/apps/sarko-api` |
| Health check gagal | container tidak naik | `docker logs --tail 100 sarko-api` di VPS |

## Setelah semua jalan

Alur normal jadi:

```
edit kode → git push → CI (lint, typecheck, test 166, build, docker) → deploy otomatis → health check
```

Tidak perlu SSH manual lagi untuk deploy rutin.
