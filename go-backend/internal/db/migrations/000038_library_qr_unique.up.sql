-- 000038: penahan keunikan kode QR buku
--
-- Latar belakang: GenerateQRBatch menghitung nomor awal dengan
--   SELECT MAX(end_sequence)+1 ... lalu INSERT, di LUAR transaksi.
-- Dua permintaan yang berbarengan bisa membaca MAX yang sama, lalu
-- menyisipkan rentang yang sama pula. Terbukti: 20 permintaan
-- bersamaan menghasilkan nomor 39, 40, 41 kembar.
--
-- Ini tidak sekadar nomor ganda di layar. Kode QR menjadi primary key
-- library_assets.id, jadi dua buku fisik berkode sama berarti buku
-- kedua TIDAK BISA didaftarkan — padahal stikernya sudah terlanjur
-- ditempel ke buku. Kesalahan yang tak bisa diperbaiki lewat layar.
--
-- Tabel ini menahan setiap kode yang pernah dibagikan. Karena `code`
-- adalah primary key, kode kembar otomatis ditolak SQLite; kode
-- GenerateQRBatch lalu mencoba nomor berikutnya.
--
-- Baris di sini hanya penahan, bukan data aset. Kode baru dicadangkan
-- saat dibagikan, jadi tidak menunggu buku didaftarkan (alurnya
-- memang: tempel stiker dulu, input buku belakangan).

CREATE TABLE IF NOT EXISTS library_qr_codes (
    code       TEXT PRIMARY KEY,
    batch_id   TEXT NOT NULL,
    created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_library_qr_codes_batch
    ON library_qr_codes(batch_id);
