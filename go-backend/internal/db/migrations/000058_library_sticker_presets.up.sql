-- Preset tata letak stiker QR yang disimpan operator.
-- Dipakai halaman Generator QR (perpustakaan) supaya ukuran kertas & label
-- yang sudah diatur tidak perlu dimasukkan ulang tiap kali.
-- Dibagi ke semua operator admin (tersimpan di DB, bukan browser).

CREATE TABLE IF NOT EXISTS library_sticker_presets (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,

    -- Semua ukuran dalam milimeter.
    paper_width  REAL NOT NULL,
    paper_height REAL NOT NULL,
    label_width  REAL NOT NULL,
    label_height REAL NOT NULL,
    gap_x        REAL NOT NULL DEFAULT 0,
    gap_y        REAL NOT NULL DEFAULT 0,
    font_size    REAL NOT NULL DEFAULT 10,

    created_by   TEXT NULL,          -- users.id pembuat (jejak audit)
    created_at   INTEGER,
    updated_at   INTEGER
);
