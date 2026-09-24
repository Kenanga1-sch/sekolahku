# Integrations

Folder ini menampung **kode sumber proyek pihak ketiga / eksternal** yang akan
diintegrasikan ke dalam web Sekolahku.

## Tujuan

- Menyimpan salinan kode sumber asli proyek yang akan diintegrasikan, agar
  mudah dibaca, dimodifikasi, dan dilacak asalnya.
- Memisahkan kode eksternal dari kode utama aplikasi (`app/`, `components/`,
  `lib/`, `go-backend/`) supaya tidak tercampur.
- Menjadi tempat rujukan (referensi) selama proses integrasi.

## Struktur yang disarankan

Setiap proyek yang diintegrasikan mendapat **satu subfolder** di dalam sini:

```
integrations/
  <nama-proyek>/
    README.md          # catatan: asal, lisensi, versi, cara integrasi
    src/               # kode sumber asli
    ...
```

## Catatan penting

- **Jangan** menaruh kode ini langsung ke dalam build aplikasi tanpa melalui
  proses integrasi yang jelas (salin logika ke `lib/`/`components/` atau jadikan
  paket yang di-import).
- Cantumkan **asal (URL repo/release)**, **versi**, dan **lisensi** proyek di
  README masing-masing subfolder.
- Jika proyek memiliki `node_modules`, `dist`, atau artefak build besar,
  pastikan diabaikan lewat `.gitignore` agar tidak memberatkan repo.

## Status

- [x] **docstation** — proxy scan (eSCL) & cetak (IPP/RAW) ke printer LAN.
      Mesin dipindah ke `lib/docstation/` (React) + `go-backend/internal/handlers/docstation_handler.go`.
- [x] **cloudstorage** — penyimpanan berkas pribadi per-user dengan backend
      Telegram Bot API lokal. Logika di-port ke `go-backend/internal/cloudstorage/`
      (Echo) + UI React di `app/(dashboard)/cloud-storage/`.

> Catatan: kode sumber asli `integrations/cloudstorage/` sempat rusak (syntax
> error akibat edit otomatis yang gagal di `handler.go`, `repository.go`,
> `telegram/client.go`). Implementasi produksi ditulis ulang bersih di dalam
> `go-backend` (bukan memakai kode rusak tersebut). Salinan sumber disimpan
> sebagai referensi arsitektur saja.
