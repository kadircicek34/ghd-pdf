#!/usr/bin/env bash
set -euo pipefail

# GH PDF üretim derlemesi.
# Çıktı: dist/ (BentoPDF, /uygulama/ altında çalışacak şekilde)
# Portal + PocketBase imajı Dockerfile.ghd tarafından paketlenir.

cd "$(dirname "$0")/.."

export SIMPLE_MODE=true
export BASE_URL=/uygulama/
export VITE_DEFAULT_LANGUAGE=tr
export VITE_BRAND_NAME="GH PDF"
export VITE_BRAND_LOGO="ghdpdf-logo.png"
export VITE_FOOTER_TEXT="© 2026 Global Hukukçular Derneği"
export VITE_USE_CDN=false
export DISABLE_GITHUB_STARS=true
export COMPRESSION_MODE=o
export SITE_URL="https://pdf.globalhukukcular.com"
export ALLOW_INDEXING=false

if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
fi

npm run build

node scripts/apply-ghd-branding.mjs

echo ""
echo "GH PDF build tamamlandı: dist/"
echo "Sonraki adım: docker compose -f deploy/docker-compose.yml up -d --build"
