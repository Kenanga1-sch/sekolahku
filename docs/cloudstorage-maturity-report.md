# Laporan Kematangan Cloud Storage

**Tanggal:** 2026-09-29
**Sumber:** docs/cloudstorage-audit-core.md, docs/cloudstorage-audit-handler.md, docs/cloudstorage-audit-repo.md, docs/cloudstorage-audit-ui.md
**Mode:** read-only, tidak ada kode produksi yang diubah untuk laporan ini.

---

## 1. Ringkasan Eksekutif

Modul cloud storage (`integrations/cloudstorage` + UI Next.js di `app/(dashboard)/cloud-storage/`) berada pada tingkat **"prototipe fungsional dengan utang teknis berat"**.

Fitur inti jalan (upload/download multi-file, folder, trash/restore, share link, pratinjau, editor teks), tetapi ada **cacat yang membuat proyek tidak bisa di-build** dan beberapa bug kebenaran yang membuat data hilang diam-diam.

Kabar baik: semua temuan sudah dipetakan dengan bukti file:line di 4 dokumen audit, jadi perbaikan bisa dikerjakan berurutan tanpa tebak-tebakan.

---

## 2. Skor Kematangan per Dimensi (skala 1-5)

| Dimensi            | Skor | Alasan singkat                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fungsional         | 3    | Fitur CRUD/share/trash jalan, tapi download file terenkripsi bisa mengembalikan ciphertext (core M-2) dan `GetFile` Telegram mengembalikan size=0 (repo KRITIS-6)                                                                                                                                                                            |
| Keamanan           | 2    | API terbuka bila AUTH_TOKEN kosong (handler K-1); enkripsi diam-diam nonaktif tanpa key (handler T-1, core m-1); XSS via SharedPage (handler R-2) dan iframe tanpa sandbox (ui T-6); cookie tanpa HttpOnly (repo RENDAH-3)                                                                                                                   |
| Reliabilitas       | 1    | Gagal compile: handler memanggil Service.Repo()/Cfg() yang tidak ada (repo BLOCKER-1), telegram doAPICall salah panggil + import hex hilang (repo BLOCKER-2/3); body response selalu tertutup (repo KRITIS-1); upload baca seluruh file ke RAM tanpa batas (core K-1); tanpa context (core K-2); API client tanpa timeout/retry (ui K-1/K-2) |
| Observability      | 2    | Tanpa request logger/request-ID (repo SEDANG-6); error di-swallow (core M-3); health membocorkan config (handler S-5); graceful shutdown dianggap error (repo TINGGI-3)                                                                                                                                                                      |
| Dokumentasi        | 3    | README/API/ARCHITECTURE/PRD ada tapi perlu cek silang endpoint + runbook backup/monitoring (lihat t5)                                                                                                                                                                                                                                        |
| DX (kualitas test) | 1    | crypto 0 test (core K-4); telegram 0 test (repo); handler hanya 5 route diuji (handler S-1); UI 0 test (ui); bug CreatedAt lolos karena assertion kurang (repo KRITIS-2)                                                                                                                                                                     |

---

## 3. Risiko Terurut Prioritas

### P0 — Perbaiki dulu (tidak bisa jalan / data rusak / terbuka publik)

1. **Gagal compile handler<->service** — `internal/handler/handler.go:58,64,73` memanggil `h.svc.Repo()/Cfg()/.DB`, tidak ada di `internal/service/service.go`. (repo BLOCKER-1)
2. **Gagal compile telegram** — `doAPICall` dipanggil sebagai fungsi bebas padahal method (client.go:197,236,283,322); `hex.DecodeString` tanpa import `encoding/hex` (client.go:366,398). (repo BLOCKER-2/3)
3. **Body Telegram selalu tertutup** — `defer resp.Body.Close()` di doAPICall lalu body di-decode pemanggil → semua operasi Telegram gagal. (repo KRITIS-1)
4. **API terbuka tanpa AUTH_TOKEN** — middleware auth hanya dipasang bila token diisi (`cmd/server/main.go:120`). (handler K-1)
5. **Upload OOM** — `io.ReadAll` seluruh file + salinan enkripsi di RAM, tanpa cek MaxUploadSize (service.go:102-106). (core K-1)
6. **Tanpa context** — tak bisa batal/timeout; retry pakai `time.Sleep` memblokir goroutine. (core K-2)
7. **CreatedAt selalu 0** — `fileColumns` tanpa `created_at` tapi insert ada; scanFile tidak memindai. (repo KRITIS-2)
8. **Enkripsi pura-pura aktif** — enabled tanpa key valid → plaintext diam-diam. (handler T-1, core m-1)
9. **API client tanpa timeout/retry/tipe error** — request bisa gantung selamanya; UI bisa terkunci. (ui K-1/K-2/K-3)
10. **Upload UI tak bisa dibatalkan** — tanpa AbortController nyata. (ui K-4)

### P1 — Keandalan & keamanan lanjutan

- Rate limit hanya di /api/login; endpoint tulis terbuka DoS. (handler T-2)
- MaxUploadSize vs BodyLimit tidak konsisten; nilai negatif diterima. (handler T-3)
- Timeout HTTP 60s membunuh download 30 menit; retry 429 kirim body kosong + double-close. (repo KRITIS-4/5)
- Migrasi tersembunyi rename file tiap boot tanpa log/transaksi. (repo TINGGI-1)
- SQLite PRAGMA per-koneksi tanpa SetMaxOpenConns. (repo TINGGI-2)
- Validasi MIME cacat logika; download terenkripsi inkonsisten; thumbnail tanpa batas (decompression bomb). (core M-1/M-2/M-4)
- Validasi upload klien nol; iframe tanpa sandbox (XSS); race load vs search. (ui T-1/T-6/T-4)
- Config tanpa Validate(); CORS default `*` vs CSRF beda sumber. (handler S-3/S-4)

### P2 — Perawatan & UX

- Duplikasi crypto (crypto.go vs telegram/client.go), duplikasi query ListFiles/Page, error di-swallow, token 96-bit, ShareToken bocor di list. (core K-3/M-3/m-2/m-4, repo SEDANG-1)
- State terfragmentasi, busy global, klik ganda, tipe file divergen, kuota menyesatkan, drag lengket. (ui S-1..S-8)
- Test tipis: tambah crypto_test, telegram client_test (httptest 429/5xx/body/size/timeout), WithTx rollback/nested, migrasi, konkuren create, handler per-endpoint, UI/api mapping. (semua audit bagian test)

---

## 4. Roadmap Perbaikan

### 30 hari (bikin bisa jalan + aman minimal)

1. Tambah aksesor `Service.Repo()/Cfg()` atau `svc.Healthy(ctx)`; bungkus `DB.Ping(ctx)`. (repo BLOCKER-1)
2. Perbaiki `c.doAPICall`, tambah import `encoding/hex` — atau hapus kripto duplikat di telegram, impor `internal/crypto`. (repo BLOCKER-2/3)
3. Serahkan `resp.Body.Close()` ke pemanggil; perbaiki retry 429 (rebuild request + GetBody, cek status akhir). (repo KRITIS-1/5)
4. Pisahkan http.Client streaming (tanpa Timeout global) vs meta (60s); teruskan size GetFile. (repo KRITIS-4/6)
5. Wajibkan AUTH_TOKEN atau flag dev eksplisit; fail-fast bila EncryptionEnabled tanpa key 64-hex valid. (handler K-1/T-1)
6. Tegakkan MaxUploadSize berlapis + LimitReader; satukan sumber BodyLimit = svc.MaxUploadSize(). (core K-1, handler T-3)
7. Tambah `created_at` ke fileColumns + scanFile + assertion test. (repo KRITIS-2)
8. Tambah helper fetch terpusat: timeout AbortSignal + retry GET idempoten + CloudApiError + signal dari UI + tombol Batal. (ui K-1..K-4)
9. Satukan jalur download terenkripsi; tambah sandbox iframe / tampilkan html sebagai teks. (core M-2, ui T-6)
10. Tambah crypto_test.go + telegram/client_test.go minimal (round-trip, nonce unik, bad key, tamper, 429 retry, body, size). (core K-4, repo)

### 90 hari (andal + terpantau)

- Context ke service/repo/telegram (QueryContext, NewRequestWithContext, select ctx.Done di retry). (core K-2)
- Rate limit global /api + ketat untuk tulis/upload; normalisasi config Validate() + log fallback env. (handler T-2/S-3)
- Migrasi bernomor transaksional + log + dry-run; SQLite SetMaxOpenConns(1)/DSN pragma; tangani Listen-vs-shutdown; tambah logger + request-ID. (repo TINGGI-1/2/3, SEDANG-6)
- Deduplikasi crypto tunggal + version byte; chunked AEAD untuk file besar; batasi thumbnail + rename atomik cache. (core K-3/M-4/M-5)
- Validasi upload klien (size/tipe/quota) + request-id/abort untuk load/search + guard in-flight + aria-label/keyboard/semantik. (ui T-1/T-4/T-5/S-2/T-2/T-3/S-7)
- Perbaiki status code (400 vs 500, 201 konsisten) + dokumentasikan matriks di API.md; jangan bocorkan telegram_api di health; cookie HttpOnly/Secure. (handler S-2/S-5, repo RENDAH-3)

### 180 hari (matang)

- FTS5 / kolom normalized untuk search; memoize GetAllActivePaths; helper transferItems + reducer navigasi/seleksi; DTO respons tanpa ShareToken; token 256-bit + hash. (repo SEDANG-2/3, ui S-1/R-7, core m-2/m-4)
- Matriks test penuh: service (size/enkripsi/download/thumbnail/trash/restore/race), repo (Tx/migrasi/konkuren/search/page), handler per-endpoint, UI (validasi/race/guard/dirty/rubber-band), plus CI `go test ./...` + `npm test`.
- Runbook backup/monitoring + dashboard usage/quota nyata (ganti baseline 5GiB hard-code). (ui S-5)

---

## 5. Rujukan File Sumber Tiap Klaim

- Core/service/crypto: `integrations/cloudstorage/internal/service/service.go`, `internal/crypto/crypto.go`, `internal/model/model.go`, `internal/service/service_test.go` — detail: docs/cloudstorage-audit-core.md
- Handler/config: `integrations/cloudstorage/internal/handler/handler.go`, `handler_test.go`, `internal/config/config.go`, `config_test.go`, `cmd/server/main.go` — detail: docs/cloudstorage-audit-handler.md
- Repo/telegram/wiring: `integrations/cloudstorage/internal/repository/repository.go`, `repository_test.go`, `internal/telegram/client.go`, `cmd/server/main.go`, `main_test.go` — detail: docs/cloudstorage-audit-repo.md
- UI/api-client: `app/(dashboard)/cloud-storage/page.tsx`, `app/(dashboard)/cloud-storage/_components/*.tsx|ts`, `lib/cloudstorage/api.ts` — detail: docs/cloudstorage-audit-ui.md

---

## 6. Catatan Jujur

- Laporan ini disusun dari 4 audit read-only tanpa menjalankan `go build`/`go test` — nomor baris adalah referensi pendekatan, verifikasi ulang dengan `grep -n` sebelum perbaiki.
- Klaim agen t2/t3/t4 "hanya docs, tanpa ubah produksi" **salah menurut diff**: `integrations/cloudstorage/internal/handler/handler.go`, `integrations/cloudstorage/internal/repository/repository.go`, `integrations/cloudstorage/API.md|ARCHITECTURE.md|PRD.md|README.md` ikut berubah. Review `git diff` sebelum merge.
- File sampah `_audit_test.tmp`/`_probe.tmp` sudah tidak ada di status git terakhir (sudah dibersihkan).
