-- 000080_print_settings.up.sql
-- Pengaturan cetak per modul laporan (margin, ulang kop, jumlah baris ikut
-- ke halaman TTD). Satu baris per modul; modul tanpa baris memakai default.
CREATE TABLE IF NOT EXISTS print_settings (
    module              TEXT PRIMARY KEY,
    margin_top_mm       REAL NOT NULL DEFAULT 10,
    margin_bottom_mm    REAL NOT NULL DEFAULT 10,
    margin_left_mm      REAL NOT NULL DEFAULT 10,
    margin_right_mm     REAL NOT NULL DEFAULT 10,
    repeat_header       INTEGER NOT NULL DEFAULT 0,
    keep_rows           INTEGER NOT NULL DEFAULT 0,
    updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
);
