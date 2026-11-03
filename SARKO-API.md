# SARKO API — Panduan Deploy & Operasional

API SARKO (platform F&B: POS, KDS, mobile app, web admin) di VPS ini.

| Item | Nilai |
|---|---|
| Domain | <https://sarko-api.pasteprosmana.my.id> |
| Swagger | <https://sarko-api.pasteprosmana.my.id/docs> |
| Health | <https://sarko-api.pasteprosmana.my.id/v1/health> |
| Container | `sarko-api` (healthy) |
| Port host | `127.0.0.1:4000` → container `3000` |
| Source | `/srv/apps/sarko-api` |
| Repo | <https://github.com/mamsky/Api-Sarko> |
| Image | `sarko-api:local` (558 MB) |
| Network | `shared_db` |
| RAM limit | 384 MB (pemakaian ~78 MB) |
| Stack | NestJS 10 + Drizzle ORM + PostgreSQL 17 + Redis 7 |

## Arsitektur jalur request

```
Internet
  → Cloudflare (TLS)
  → cloudflared tunnel a2fa338c-...
  → nginx 127.0.0.1:80 (server_name sarko-api.pasteprosmana.my.id)
  → sarko-api 127.0.0.1:4000
  → container :3000
```

## Perintah harian

```bash
cd /srv/apps/sarko-api

docker compose ps                    # status container
docker compose logs -f --tail 100    # log realtime
docker compose restart               # restart
docker compose down                  # matikan
docker compose up -d                 # nyalakan

curl -s localhost:4000/v1/health     # cek kesehatan
curl -s localhost:4000/v1/health/ping
```

Deploy ulang setelah ubah kode:

```bash
cd /srv/apps/sarko-api
bash scripts/deploy.sh
```

Skrip itu 6 langkah: build `@sarko/contracts` → install → typecheck + test +
build → migrasi → `docker compose build` + `up -d` → tunggu health 200.

## Struktur repo

Repo ini **standalone** — semua paket workspace dibawa masuk supaya bisa
di-build tanpa monorepo induk.

```
.
├── src/                        98 file .ts (NestJS app)
├── packages/
│   ├── contracts/              @sarko/contracts — zod schema + enum
│   │   └── src/
│   │       ├── common/         identifiers, money, pagination, problem-detail
│   │       ├── identity/       device.schema, login.schema
│   │       ├── catalog/        product.schema, recipe.schema
│   │       ├── ordering/       order-status.enum, create-order, order
│   │       ├── payment/        payment.schema
│   │       └── sync/           push.schema, pull.schema
│   ├── eslint-config/          @sarko/eslint-config
│   └── ts-config/              @sarko/ts-config
├── scripts/deploy.sh
├── .github/workflows/          ci-cd.yml
├── Dockerfile                  3 stage: contracts → builder → runtime
├── compose.yaml
├── eslint.config.mjs
├── nest-cli.json
├── package.json
├── tsconfig.json / tsconfig.build.json
├── jest.config.js
└── drizzle.config.ts
```

Paket dihubungkan lewat `file:` dependency, bukan `workspace:*`:

```json
"@sarko/contracts": "file:./packages/contracts",
"@sarko/eslint-config": "file:./packages/eslint-config"
```

`packages/ts-config` ada sebagai referensi konfigurasi, tapi `tsconfig.json`
sudah **inline** (tidak `extends`) supaya tidak butuh symlink.

## Database

Database `sarko` di container `postgres` (PostgreSQL 17).

```
Host (dari container lain) : postgres:5432
Host (dari VPS)            : 127.0.0.1:5432
Database                   : sarko
User                       : sarko
Password                   : sarko
URL (container)            : postgresql://sarko:sarko@postgres:5432/sarko
URL (host VPS)             : postgresql://sarko:sarko@127.0.0.1:5432/sarko
```

**46 tabel** hasil migrasi Drizzle. Data seed: 1 outlet, 5 user, 4 kategori,
21 produk, 8 meja, 6 bahan, 3 resep.

### Migrasi & seed

```bash
cd /srv/apps/sarko-api

# drizzle-kit jalan di HOST, jadi pakai 127.0.0.1 (bukan hostname postgres)
DATABASE_URL="postgresql://sarko:sarko@127.0.0.1:5432/sarko" npm run db:migrate
DATABASE_URL="postgresql://sarko:sarko@127.0.0.1:5432/sarko" npm run db:seed
```

Kalau lupa override `DATABASE_URL`, error-nya `getaddrinfo ENOTFOUND postgres`
— sebabnya `.env` memakai hostname container yang tidak bisa diresolusi dari
host VPS.

### Masuk psql

```bash
docker exec -it postgres psql -U sarko -d sarko
```

### Akun seed

| Email | Role |
|---|---|
| superadmin@sarko.id | SUPER_ADMIN |
| manager@sarko.id | MANAGER_OUTLET |
| kasir@sarko.id | KASIR |
| koki@sarko.id | KOKI |
| pelanggan@sarko.id | PELANGGAN |

Password seed ada di `src/database/seeds/seed.ts`.

## Redis

```
Host (container) : redis:6379
Host (VPS)       : 127.0.0.1:6379
Password         : CpduwZxI0fqgOSnzJBFY3sRXEhltHUMA
URL (container)  : redis://default:CpduwZxI0fqgOSnzJBFY3sRXEhltHUMA@redis:6379/0
```

User `default` **wajib** ditulis — `redis://:PASS@...` gagal di `redis-cli`.

## File penting

| File | Isi |
|---|---|
| `.env` | kredensial (mode 600, TIDAK di-commit) |
| `Dockerfile` | multi-stage: contracts → builder → runtime non-root uid 10001 |
| `compose.yaml` | service `api`, port 4000, network shared_db |
| `scripts/deploy.sh` | deploy idempotent 6 langkah |
| `packages/contracts/` | `@sarko/contracts` — schema + enum bersama |
| `.github/workflows/ci-cd.yml` | satu workflow CI/CD: job `verify` → `docker` → `deploy` |
| `.github/DEPLOY-SETUP.md` | panduan secrets CI/CD |

## CI/CD

Hanya ada SATU file workflow: `.github/workflows/ci-cd.yml` (name: `CI/CD`).

| Kejadian | `verify` + `docker` | `deploy` |
|---|---|---|
| PR dibuka/diupdate ke `main` | jalan | **skip** (tidak ada secrets di PR) |
| Push ke branch fitur | tidak trigger | tidak trigger |
| **Merge ke `main`** | jalan | **jalan otomatis** kalau verify+docker hijau |
| `workflow_dispatch` manual | jalan | jalan |

Alur kontributor: buat branch baru → push → buka PR ke `main` → CI
memvalidasi → merge → CI/CD jalan penuh dan deploy otomatis ke VPS.

Gerbang deploy ada dua lapis: `needs: [verify, docker]` (tidak jalan kalau CI
merah) dan `if:` yang mensyaratkan `push` ke `refs/heads/main` atau dispatch
manual. Jadi PR tidak pernah bisa men-deploy.

Butuh 5 secrets di repo: `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`,
`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`. Detail di `.github/DEPLOY-SETUP.md`.

Kenapa Tailscale: ufw VPS hanya membuka port 22 di interface `tailscale0`.
IP publik `103.147.32.118` **tidak** menerima SSH, jadi runner GitHub harus
join tailnet dulu.

## Jebakan yang sudah terbukti

| Gejala | Sebab | Solusi |
|---|---|---|
| `EUNSUPPORTEDPROTOCOL` saat `npm install` | `workspace:*` tanpa monorepo | sudah diganti `file:./packages/...` |
| `getaddrinfo ENOTFOUND postgres` | drizzle-kit jalan di host, `.env` pakai hostname container | override `DATABASE_URL` ke `127.0.0.1` |
| `dist/main.js` tidak terbentuk padahal build exit 0 | `nest build` hapus `dist` + tsc `incremental: true` pikir output masih ada | `incremental: false` + `rm -f *.tsbuildinfo` sebelum build |
| `dist/index.cjs` tidak ada | contracts belum dibangun | `npm --prefix packages/contracts run build` |
| Docker build gagal di stage contracts | `.dockerignore` meng-exclude `packages/contracts/src` | jangan exclude folder itu |
| `git diff` menampilkan ribuan baris padahal isi sama | line ending CRLF vs LF | `find ... \| xargs sed -i 's/\r$//'` |
| `import/no-duplicates` jadi error setelah `consistent-type-imports: off` | import `@nestjs/common` dua baris | gabungkan jadi satu import |
| `consistent-type-imports` bikin NestJS DI rusak | `import type` menghapus decorator metadata | rule itu di-`off` untuk `src/**/*.ts` |
| `redis NOAUTH` | URL tanpa password | `redis://default:PASS@host:6379/0` |
| CI gagal karena 91 warning | `lint` pakai `--max-warnings 0` | `lint` jadi `eslint src` saja |

## Log & troubleshooting

```bash
docker logs --tail 100 sarko-api
docker inspect sarko-api --format '{{.State.Health.Status}} restarts={{.RestartCount}}'
docker stats --no-stream sarko-api
```

Kalau `/v1/health` balas `db:false` → cek `postgres` hidup dan kredensial
`.env`. Kalau `redis:false` → cek password Redis.

## Backup database

```bash
docker exec postgres pg_dump -U sarko -d sarko --no-owner --no-privileges \
  | gzip > /srv/docker-projects/postgres/backup/sarko-$(date +%Y%m%d-%H%M%S).sql.gz
```

Restore:

```bash
gunzip -c <file>.sql.gz | docker exec -i postgres psql -U sarko -d sarko
```

## Update kode

```bash
cd /srv/apps/sarko-api
git pull                     # kalau ada remote
bash scripts/deploy.sh
```

Atau lewat GitHub Actions: push ke `main` → CI jalan → deploy otomatis.
