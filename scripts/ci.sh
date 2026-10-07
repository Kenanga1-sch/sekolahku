#!/bin/bash
# ==========================================
# CI Script — Sekolahku (self-hosted)
# Menjalankan: lint, typecheck, unit test, build
# Dipanggil oleh post-receive hook.
# Exit 0 = semua lulus, Exit 1 = ada yg gagal.
# ==========================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_DIR"

export PATH="/usr/local/go/bin:$PATH"

echo "╔══════════════════════════════════════════╗"
echo "║   SEKOLAHKU CI — Test & Build            ║"
echo "╚══════════════════════════════════════════╝"
echo "→ Repo: $REPO_DIR  (commit $(git rev-parse --short HEAD 2>/dev/null || echo n/a))"
echo ""

# ─────────────────────────────────────────
# 1/6  Frontend: install deps
# ─────────────────────────────────────────
echo "▶ [1/6] Frontend: npm ci"
if [ ! -d node_modules/.package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  echo "  node_modules ada, skip install."
fi

# ─────────────────────────────────────────
# 2/6  Frontend: ESLint
# ─────────────────────────────────────────
echo "▶ [2/6] Frontend: ESLint"
if ! npm run lint; then
  echo "✗ ESLint GAGAL"
  exit 1
fi

# ─────────────────────────────────────────
# 3/6  Frontend: TypeScript typecheck
# ─────────────────────────────────────────
echo "▶ [3/6] Frontend: TypeScript typecheck"
if ! npx tsc --noEmit; then
  echo "✗ Typecheck GAGAL"
  exit 1
fi

# ─────────────────────────────────────────
# 4/6  Frontend: unit test (vitest)
# ─────────────────────────────────────────
echo "▶ [4/6] Frontend: unit test (vitest)"
if ! npm run test -- --run; then
  echo "✗ Unit test GAGAL"
  exit 1
fi

# ─────────────────────────────────────────
# 5/6  Build frontend DULU + siapkan embed Go
# ─────────────────────────────────────────
# static.go memakai `//go:embed all:dist` dan folder
# go-backend/cmd/api/dist di-gitignore — jadi out/ hasil next build
# (static export) wajib disalin ke sana SEBELUM go vet/test/build.
# Tanpa ini: "pattern all:dist: no matching files found".
echo "▶ [5/6] Build: frontend (next build) + siapkan dist embed"
if ! npm run build; then
  echo "✗ next build GAGAL"
  exit 1
fi
rm -rf go-backend/cmd/api/dist
mkdir -p go-backend/cmd/api/dist
cp -r out/. go-backend/cmd/api/dist/

# ─────────────────────────────────────────
# 6/6  Backend: go vet + test + build binary
# ─────────────────────────────────────────
echo "▶ [6/6] Backend: go vet + test + build binary"
( cd go-backend && go vet ./... && go test ./... )
( cd go-backend && CGO_ENABLED=0 go build -o sekolahku_linux ./cmd/api )

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✓ CI LULUS — build siap deploy         ║"
echo "╚══════════════════════════════════════════╝"
