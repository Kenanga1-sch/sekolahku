-- ============================================================
-- 000063: Surat Keluar modular (editor blok).
--   layout_type    : "MODULAR" bila dibuat via editor modular (null = format lain).
--   content_blocks : JSON susunan blok + jenis surat, agar dapat diedit ulang.
-- ============================================================

ALTER TABLE surat_keluar ADD COLUMN layout_type TEXT;
ALTER TABLE surat_keluar ADD COLUMN content_blocks TEXT;
