# syntax=docker/dockerfile:1

# ---------- stage 1: build @sarko/contracts ----------
FROM node:20-slim AS contracts
WORKDIR /build

COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/contracts/tsconfig.json ./packages/contracts/tsconfig.json
RUN cd packages/contracts && npm install --no-audit --no-fund

COPY packages/contracts/src ./packages/contracts/src
RUN cd packages/contracts \
 && npm run build \
 && test -f dist/index.js \
 && test -f dist/index.cjs \
 && test -f dist/index.d.ts

# ---------- stage 2: build aplikasi ----------
FROM node:20-slim AS builder
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /build

COPY package.json ./
COPY --from=contracts /build/packages/contracts ./packages/contracts
RUN npm install --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
# panggil nest langsung supaya hook `prebuild` (build ulang contracts) tidak jalan lagi
RUN ./node_modules/.bin/nest build && test -f dist/main.js

RUN npm prune --omit=dev \
 && rm -rf packages/contracts/node_modules packages/contracts/src packages/contracts/package-lock.json

# ---------- stage 3: runtime ----------
FROM node:20-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Jakarta

WORKDIR /app

COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/packages/contracts ./packages/contracts
COPY package.json ./

RUN groupadd -g 10001 sarko \
 && useradd -u 10001 -g sarko -M -s /usr/sbin/nologin sarko \
 && chown -R sarko:sarko /app

USER sarko
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=6s --start-period=45s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT||3000,path:'/v1/health',timeout:4000},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["node","dist/main.js"]
