-- 000077_tabungan_gtk.down.sql
DROP INDEX IF EXISTS idx_tabungan_gtk_transaksi_created;
DROP INDEX IF EXISTS idx_tabungan_gtk_transaksi_gtk;
DROP TABLE IF EXISTS tabungan_gtk_transaksi;
DROP INDEX IF EXISTS idx_tabungan_gtk_employee;
DROP TABLE IF EXISTS tabungan_gtk;
