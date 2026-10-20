# Design baseline artifacts

Hasil audit UI/UX awal (20 Oktober 2026). Ringkasan dan analisis ada di
[`../DESIGN_AUDIT.md`](../DESIGN_AUDIT.md).

- `report.json` — screenshot check, metrik halaman, dan hasil axe-core 12 halaman.
- `login-page.json` — hasil khusus halaman login (4 viewport).
- `impeccable.json` — 28 temuan detektor Impeccable v4.7.0.

Screenshot tidak disimpan di repo karena halaman dashboard memuat data produksi.
Jalankan ulang audit dengan:

```bash
npm run audit:design
BASE_URL=http://localhost:8181 npm run audit:ui
```

Token sesi (opsional, untuk halaman dashboard) hanya dibaca dari environment
`SESSION_TOKEN` dan `USER_INFO`; jangan menulisnya ke file.

## Snapshot terakhir

Laman publik + dashboard (dengan sesi admin) diaudit pada 20 Oktober 2026 via Playwright

- axe-core dan Impeccable v4.7.0. Hasil tersimpan di `run/report-2026-10-20.json`.

Ringkasan hasil: **axe-violations = 0**, **impeccable-findings = 0**.
