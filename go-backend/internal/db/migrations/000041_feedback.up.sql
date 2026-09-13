-- Kritik, saran & pengaduan: memperluas formulir kontak lama menjadi
-- layanan masukan publik. Kolom baru:
--   category  : kritik | saran | pengaduan | lainnya
--   status    : baru | diproses | selesai (ditindaklanjuti admin)
--   ticket    : kode 6 karakter untuk pelapor mengecek status tanpa login
--   updated_at: penanda perubahan status
-- Email & nama kini opsional di level aplikasi (pengaduan bisa anonim);
-- phone dipakai sebagai kanal tindak lanjut alternatif.
ALTER TABLE contact_messages ADD COLUMN category TEXT NOT NULL DEFAULT 'lainnya';
ALTER TABLE contact_messages ADD COLUMN status TEXT NOT NULL DEFAULT 'baru';
ALTER TABLE contact_messages ADD COLUMN ticket TEXT;
ALTER TABLE contact_messages ADD COLUMN updated_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_contact_ticket ON contact_messages(ticket);
