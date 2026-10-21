# AGENTS.md — Sekolahku

Panduan kerja untuk agen otomatis di repo ini.

## Alur wajib: commit + deploy setiap perubahan

Setiap perubahan kode **wajib langsung di-commit lalu di-deploy** tanpa menunggu
perintah tambahan dari pengguna.

1. Verifikasi sebelum commit: `npx tsc --noEmit`, tes terkait
   (`npx vitest run <file>`), dan `npm run lint` bila menyentuh banyak file.
2. Commit dengan pesan konvensional (`feat:`, `fix:`, `docs:`, `refactor:`).
3. Push ke remote deploy (bukan `origin`): `git push selfhost main`.
4. Pantau `/opt/sekolahku-prod/backups/cicd.log` sampai
   `✓✓ DEPLOY PRODUKSI BERHASIL.` / `═══════ Pipeline selesai ═══════`.
   Jangan mengandalkan exit code push: hook post-receive menjalankan pipeline
   secara sinkron, jadi jalankan push terlepas dari shell (`setsid -f`) agar
   tidak terbunuh saat tool timeout.
5. Setelah deploy: cek `http://localhost:3001/api/health` dan
   `http://localhost:8181/api/health` = 200, plus aset baru bila relevan.
6. Bila pipeline gagal, perbaiki dan commit baru (jangan amend), lalu deploy
   ulang. Jangan biarkan `.last_deploy_failed` menetap.

## Catatan

- `origin` = GitHub (cadangan), `selfhost` = sumber CI/CD. Push ke keduanya
  bila memungkinkan.
- Perubahan DB harus punya pasangan `.up.sql` dan `.down.sql`.
- Deploy produksi blue-green: cek `/opt/sekolahku-prod/backups/.last_deploy_failed`
  setelah pipeline.
- Jangan pernah menaruh secret di repo.
