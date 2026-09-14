-- Kop surat: nama pemerintah daerah dan nama dinas.
-- Digunakan di PDF registrant, bukti pendaftaran, dan surat resmi.

ALTER TABLE school_settings ADD COLUMN governance_name TEXT;
ALTER TABLE school_settings ADD COLUMN department_name TEXT;
