#!/usr/bin/env bash
# Verifikasi konversi template xlsx → PDF via LibreOffice (manual/dev &
# pasca-deploy). Dipakai saat mengubah template/modul cetak.
#
# Pemakaian:
#   scripts/verify-template-pdf.sh <path.xlsx>           # soffice lokal
#   scripts/verify-template-pdf.sh --dev <path.xlsx>     # lewat container sekolahku-dev
set -euo pipefail

MODE="lokal"
if [[ "${1:-}" == "--dev" ]]; then
  MODE="dev"
  shift
fi
XLSX="${1:?pemakaian: $0 [--dev] <path.xlsx>}"

[[ -f "$XLSX" ]] || { echo "file tidak ada: $XLSX" >&2; exit 1; }

BASE="$(basename "$XLSX")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [[ "$MODE" == "dev" ]]; then
  podman cp "$XLSX" "sekolahku-dev:/tmp/$BASE"
  podman exec sekolahku-dev sh -c "soffice --headless --norestore \
    -env:UserInstallation=file:///tmp/lo-verify-profile \
    --convert-to pdf --outdir /tmp \"/tmp/$BASE\" >/dev/null && \
    { pdfinfo \"/tmp/${BASE%.xlsx}.pdf\" 2>/dev/null || \
      grep -aoE 'MediaBox \[[^]]+\]' \"/tmp/${BASE%.xlsx}.pdf\" | head -1; } && \
    ls -la \"/tmp/${BASE%.xlsx}.pdf\""
  exit 0
fi

command -v soffice >/dev/null 2>&1 || {
  echo "soffice tidak ditemukan — pakai --dev (container) atau pasang LibreOffice" >&2
  exit 1
}

echo "→ konversi $XLSX …"
soffice --headless --norestore \
  "-env:UserInstallation=file://$TMP/lo-profile" \
  --convert-to pdf --outdir "$TMP" "$XLSX" >/dev/null

PDF="$TMP/${BASE%.xlsx}.pdf"
[[ -f "$PDF" ]] || { echo "PDF tidak dihasilkan" >&2; exit 1; }

if command -v pdfinfo >/dev/null 2>&1; then
  pdfinfo "$PDF" | grep -E "^(Pages|Page size)"
elif command -v qpdf >/dev/null 2>&1; then
  echo "halaman: $(qpdf --show-npages "$PDF")"
  grep -aoE 'MediaBox \[[^]]+\]' "$PDF" | head -1
else
  grep -aoE 'MediaBox \[[^]]+\]' "$PDF" | head -1
fi
echo "✓ selesai (PDF di $PDF, TMP dihapus otomatis)"
