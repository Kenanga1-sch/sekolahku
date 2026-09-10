-- Tabel penyimpanan hash rekening koran.
--
-- Sebelumnya "verifikasi" rekening koran hanya mencocokkan hash dengan
-- ID transaksi (SELECT id FROM tabungan_transaksi WHERE id = ?) — hash-nya
-- sendiri tak pernah dibuat, dan yang dikirim bisa ditebak. Pernyataan
-- kini disimpan utuh: hash acak sebagai kunci, payload untuk ditampilkan
-- ulang di halaman verifikasi publik.
CREATE TABLE IF NOT EXISTS savings_statement_hashes (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    opening_balance INTEGER NOT NULL DEFAULT 0,
    total_debit INTEGER NOT NULL DEFAULT 0,
    total_credit INTEGER NOT NULL DEFAULT 0,
    closing_balance INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_statement_hashes_student
    ON savings_statement_hashes (student_id, created_at DESC);
