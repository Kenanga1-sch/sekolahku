# 🎓 Sitaku & SmartLib (Sekolahku)

Sistem Informasi Terpadu Akademik dan Keuangan (Sitaku) & Smart Library (SmartLib). Platform manajemen sekolah modern yang dibangun dengan Next.js 16, mengintegrasikan manajemen Perpustakaan, Tabungan Siswa, Inventaris, dan Registrasi Siswa Baru (SPMB).

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.0-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?logo=tailwindcss)

## 🚀 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Library UI**: React 19, Shadcn UI, Tailwind CSS 4
- **ORM**: Drizzle ORM
- **Database**: SQLite (better-sqlite3)
- **Auth**: NextAuth.js v5
- **State Management**: Zustand & SWR
- **Monitoring**: Sentry

## 🛠️ Cheat Sheet: Command Penting

### 1. Install Dependencies
Pastikan Node.js versi terbaru sudah terinstal.
```bash
npm install
```

### 2. Setup Database (PENTING)
Jika Anda menemui error seperti **"no such table"**, jalankan perintah push untuk mensinkronkan skema ke database SQLite lokal:
```bash
# Sinkronisasi Skema (Solusi Error 'no such table')
npx drizzle-kit push

# (Opsional) Cek database via Studio
npx drizzle-kit studio
```

### 3. Seeding Data (Segera Hadir)
Untuk mengisi data awal (Admin, Sekolah, Tahun Ajaran), jalankan:
```bash
npx tsx scripts/seed.ts
```
*Catatan: Gunakan kredensial default `admin@sekolahku.id` / `admin123` setelah seeding.*

### 4. Menjalankan Aplikasi

**Mode Development:**
```bash
npm run dev
```

**Mode Production Build:**
```bash
npm run build
npm run start:prod
```

## 📁 Struktur Folder Utama

- `app/`: Routing, UI Pages, dan Server Actions.
- `components/`: Komponen UI (Shared & UI Kit Shadcn).
- `db/`: Skema database dan konfigurasi Drizzle.
- `lib/`: Utilitas, Helper logika, dan konstanta.
- `actions/`: Kumpulan Server Actions untuk mutasi data.
- `scripts/`: Script maintenance dan seeding database.

## 🔒 Aturan Pengembangan (AI & Dev Context)
Lihat [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) untuk panduan teknis mendalam dan aturan penulisan kode.

## 📊 Skema Database
Lihat [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) untuk detail struktur tabel dan relasi.

## 🔄 Alur Bisnis
Lihat [WORKFLOWS.md](./WORKFLOWS.md) untuk penjelasan logika fitur-fitur kompleks.

---
Built with ❤️ for Indonesian Education
