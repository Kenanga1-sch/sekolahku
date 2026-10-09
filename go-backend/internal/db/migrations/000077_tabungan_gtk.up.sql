-- 000077_tabungan_gtk.up.sql
-- Rekening tabungan milik GTK (guru & tenaga kependidikan) — terpisah dari
-- tabungan_siswa. Kartu GTK yang di-scan di stasiun tabungan bisa setor/tarik.
-- Sengaja ringkas (saldo + transaksi), tanpa brankas/hutang/kelas milik siswa.
CREATE TABLE IF NOT EXISTS tabungan_gtk (
    id TEXT PRIMARY KEY,
    employee_id TEXT UNIQUE NOT NULL REFERENCES employee_details(id) ON DELETE CASCADE,
    saldo_terakhir INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
);
CREATE INDEX idx_tabungan_gtk_employee ON tabungan_gtk(employee_id);

CREATE TABLE IF NOT EXISTS tabungan_gtk_transaksi (
    id TEXT PRIMARY KEY,
    gtk_id TEXT NOT NULL REFERENCES tabungan_gtk(id) ON DELETE CASCADE,
    user_id TEXT,
    tipe TEXT NOT NULL,
    nominal INTEGER NOT NULL,
    status TEXT DEFAULT 'posted',
    catatan TEXT,
    created_at INTEGER
);
CREATE INDEX idx_tabungan_gtk_transaksi_gtk ON tabungan_gtk_transaksi(gtk_id);
CREATE INDEX idx_tabungan_gtk_transaksi_created ON tabungan_gtk_transaksi(created_at);
