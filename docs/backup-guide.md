# Panduan Backup & Disaster Recovery SekolahKu

## 1. Backup Otomatis

Sistem dilengkapi dengan script backup otomatis yang mencakup:

- **Database**: Menyimpan seluruh data siswa, nilai, dan transaksi.
- **File Uploads**: Menyimpan foto dan dokumen hasil upload.
- **Retensi**: Backup yang lebih tua dari 7 hari akan otomatis dihapus.

### Cara Menjalankan Backup Manual

Buka terminal di folder project dan jalankan:

```bash
npm run backup
```

Hasil backup akan tersimpan di folder:

- `backups/db/`
- `backups/files/`

### Cara Menjadwalkan Otomatis (Windows Task Scheduler)

Agar backup berjalan otomatis setiap malam:

1.  Buka **Task Scheduler**.
2.  Klik **Create Basic Task**.
3.  Nama: `SekolahKu Backup`.
4.  Trigger: **Daily**, Pukul **02:00:00**.
5.  Action: **Start a Program**.
    - Program/script: `cmd.exe`
    - Arguments: `/c cd /d D:\antigravity\sekolahku && npm run backup`
6.  Finish.

## 2. Prosedur Restore (Pemulihan)

Jika terjadi kerusakan data atau server mati.

### Skenario A: Salah Hapus Data (Restore Database)

1.  Stop aplikasi (`Ctrl+C` di terminal).
2.  Buka folder `backups/db/`.
3.  Pilih file `.db` dengan tanggal terakhir yang valid (misal `sekolahku-2025-01-27.db`).
4.  Copy file tersebut ke folder `data/`.
5.  Rename menjadi `sekolahku.db` (timpa file lama/rusak).
6.  Start aplikasi kembali (`npm run dev`).

### Skenario B: Server Mati Total (Pindah Komputer)

1.  Install Node.js & Git di komputer baru.
2.  Clone/Copy source code aplikasi.
3.  Ambil file backup terakhir (DB + Files) dari penyimpanan eksternal (Google Drive/USB).
4.  Restore DB seperti Skenario A.
5.  Extract file upload backup (`uploads-xxx.tar.gz`) ke folder `public/uploads`.
6.  Jalankan `npm install` dan `npm run dev`.
