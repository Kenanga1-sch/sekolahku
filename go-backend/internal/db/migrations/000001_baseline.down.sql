-- Rollback Baseline
DROP INDEX IF EXISTS idx_loans_status;
DROP INDEX IF EXISTS idx_library_loans_is_returned;
DROP INDEX IF EXISTS idx_tabungan_transaksi_siswa;
DROP INDEX IF EXISTS idx_finance_transactions_account;
DROP INDEX IF EXISTS idx_finance_transactions_date;
DROP INDEX IF EXISTS idx_spmb_registrants_reg_num;
DROP INDEX IF EXISTS idx_spmb_registrants_status;

DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS klasifikasi_surat;
DROP TABLE IF EXISTS generated_letters;
DROP TABLE IF EXISTS letter_templates;
DROP TABLE IF EXISTS library_visits;
DROP TABLE IF EXISTS library_loans;
DROP TABLE IF EXISTS library_members;
DROP TABLE IF EXISTS library_assets;
DROP TABLE IF EXISTS library_catalog;
DROP TABLE IF EXISTS tabungan_transaksi;
DROP TABLE IF EXISTS tabungan_siswa;
DROP TABLE IF EXISTS tabungan_kelas;
DROP TABLE IF EXISTS finance_transactions;
DROP TABLE IF EXISTS finance_categories;
DROP TABLE IF EXISTS finance_accounts;
DROP TABLE IF EXISTS spmb_registrants;
DROP TABLE IF EXISTS spmb_periods;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS school_settings;

