-- 000030_remap_legacy_ids.up.sql
-- Remap legacy module row IDs (tabungan_siswa.id / library_members.id) to students.id
-- so historical transaksi/hutang/setoran-detail/loan references resolve after 000029.
-- Safe on fresh DBs (no-op) and idempotent.

-- 1. tabungan_transaksi.siswa_id may hold legacy tabungan_siswa.id values
UPDATE tabungan_transaksi
SET siswa_id = COALESCE(
    (SELECT ts.student_id FROM tabungan_siswa ts WHERE ts.id = tabungan_transaksi.siswa_id),
    siswa_id
);

-- 2. tabungan_hutang.siswa_id may hold legacy tabungan_siswa.id values
UPDATE tabungan_hutang
SET siswa_id = COALESCE(
    (SELECT ts.student_id FROM tabungan_siswa ts WHERE ts.id = tabungan_hutang.siswa_id),
    siswa_id
);

-- 3. library_loans.member_id may hold legacy library_members.id values
--    (rows seeded post-000029 use id = 'lib_' || student_id, which still resolve via the
--     same lookup, so only remap when a matching row with a DIFFERENT id exists)
UPDATE library_loans
SET member_id = COALESCE(
    (SELECT lm2.id FROM library_members lm2
     JOIN library_members lm1 ON lm1.student_id = lm2.student_id
     WHERE lm1.id = library_loans.member_id AND lm2.id != lm1.id
     LIMIT 1),
    member_id
);

-- 4. library_visits.member_id same treatment
UPDATE library_visits
SET member_id = COALESCE(
    (SELECT lm2.id FROM library_members lm2
     JOIN library_members lm1 ON lm1.student_id = lm2.student_id
     WHERE lm1.id = library_visits.member_id AND lm2.id != lm1.id
     LIMIT 1),
    member_id
);
