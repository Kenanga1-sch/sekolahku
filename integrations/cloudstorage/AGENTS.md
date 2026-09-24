# AGENTS.md: Panduan Kembang-Koding

Pedoman teknis untuk AI dan pengembang saat berkontribusi pada proyek ini.

---

## 1. Aturan Umum

- **Bahasa Koding**: Go (Backend) + Vanilla JavaScript (Frontend).
- **Zero Framework Frontend**: Jangan gunakan React, Vue, Svelte, atau build tools berat (Webpack/Vite). Gunakan file statis murni (`index.html`, `app.js`, `style.css`) yang di-embed langsung ke binary Go menggunakan `go:embed`.
- **Zero Comments**: JANGAN menambahkan komentar pada kode kecuali diminta secara eksplisit.
- **Bahasa Komunikasi**: Bahasa Indonesia untuk percakapan dan dokumentasi proyek jika diminta.

---

## 2. Standar Koding Go (`internal/`)

- Gunakan framework ringan seperti `github.com/gofiber/fiber/v2` atau `github.com/labstack/echo/v4`.
- Gunakan database driver `modernc.org/sqlite` (Pure Go SQLite) agar tidak memerlukan dependensi CGO saat dicompile menjadi binary tunggal.
- Gunakan penanganan error yang eksplisit.
- Tutup resource (`resp.Body`, `rows`, dll.) dengan `defer`.

---

## 3. Standar Frontend (`web/static/`)

- Gunakan modern Vanilla JS (ES6+).
- State manajemen sederhana menggunakan objek global atau `localStorage`.
- Tangkap event keyboard dengan rapi (`Ctrl+C`, `Ctrl+V`, `Ctrl+X`, `F2`, `Delete`).
- Desain UI bersih minimalis ala Google Drive menggunakan CSS Flexbox/Grid dan SVG Icons sederhana.

---

## 4. Linting & Pengujian

- Jalankan `go fmt ./...` sebelum menyelesaikan tugas.
- Jalankan `go test ./...` untuk memastikan tidak ada regresi pada logika backend.
