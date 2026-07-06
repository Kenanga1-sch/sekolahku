-- Add 'terbayar' column to tabungan_hutang
ALTER TABLE tabungan_hutang ADD COLUMN terbayar INTEGER DEFAULT 0;

-- Migrate existing data
UPDATE tabungan_hutang SET terbayar = nominal * jumlah WHERE status = 'lunas';

-- Create table tabungan_hutang_pembayaran
CREATE TABLE IF NOT EXISTS tabungan_hutang_pembayaran (
    id TEXT PRIMARY KEY,
    hutang_id TEXT NOT NULL,
    nominal INTEGER NOT NULL,
    metode TEXT NOT NULL, -- cash, tabungan
    transaksi_id TEXT, -- nullable, refers to tabungan_transaksi(id)
    dicatat_oleh TEXT,
    created_at INTEGER,
    FOREIGN KEY (hutang_id) REFERENCES tabungan_hutang(id)
);
