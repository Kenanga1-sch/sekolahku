# 🗄️ Database Schema Reference

This document provides a detailed overview of the Sekolahku database schema, organized by module. The project uses **SQLite** with **Drizzle ORM**.

## 👥 Authentication & Users

Core tables for user management and authentication (NextAuth.js).

### `users`

Central user table.

- **id**: Primary Key (CUID).
- **email**: Unique email address.
- **role**: Role of the user (`superadmin`, `admin`, `staff`, `librarian`, `guru`, `siswa`, `user`).
- **username**: Unique username.
- **password_hash**: Hashed password.
- **full_name**: Full name.
- **is_active**: Boolean flag for active account.

### `profiles`

Extended user profile information.

- **user_id**: Foreign Key to `users`.
- **nip_nisn**: Employee ID or Student ID.
- **phone**: Contact number.
- **address**: Residential address.

### `accounts` & `sessions`

Standard NextAuth.js tables for managing OAuth accounts and active sessions.

---

## 🎓 Academic Module

Manages student data and class organization.

### `students`

Master data for students.

- **id**: Primary Key.
- **nisn**: National Student ID number (Unique).
- **nis**: School Student ID (Unique).
- **full_name**: Student's full name.
- **class_id**: Foreign Key to `student_classes`.
- **status**: Enrollment status (`active`, `graduated`, `transferred`, etc.).
- **qr_code**: Unique QR code for identification.
- **parent_name**, **parent_phone**: Parent contact info.

### `student_classes`

Class definitions (Rombongan Belajar).

- **id**: Primary Key.
- **name**: Class name (e.g., "1A").
- **grade**: Grade level (1-6).
- **academic_year**: e.g., "2025/2026".
- **teacher_name**: Homeroom teacher name.

### `employee_details`

Extended details for school employees (Teachers/Staff).

- **user_id**: Foreign Key to `users`.
- **nip**, **nuptk**, **nik**: Identification numbers.
- **employment_status**: Employment type (PNS, GTY, etc.).
- **job_type**: Job role (Guru Kelas, Staff TU, etc.).

---

## 📝 SPMB (Student Admission)

Manages new student registration.

### `spmb_periods`

Admission periods/waves.

- **academic_year**: The academic year for admission.
- **start_date**, **end_date**: Period duration.
- **quota**: Maximum number of students.
- **is_active**: Boolean flag.

### `spmb_registrants`

Candidates registering for admission.

- **registration_number**: Unique registration ID.
- **full_name**, **nik**, **birth_date**, **birth_place**: Personal details.
- **address**, **home_lat**, **home_lng**: Location data for zoning.
- **distance_to_school**: Calculated distance.
- **status**: Registration status (`draft`, `pending`, `verified`, `accepted`, `rejected`).
- **period_id**: Foreign Key to `spmb_periods`.

---

## 📚 Library Module (SmartLib)

Manages book catalog, physical assets, and circulation.

### `library_catalog`

Bibliographic metadata (Title, Author, ISBN).

- **isbn**: International Standard Book Number.
- **title**, **author**, **publisher**: Book details.
- **category**: Book category (Dewey Decimal or Custom).

### `library_assets`

Physical copies of books.

- **id**: QR Code string (Primary Key).
- **catalog_id**: Foreign Key to `library_catalog`.
- **status**: Availability (`AVAILABLE`, `BORROWED`, `DAMAGED`, `LOST`).
- **location**: Shelf location.

### `library_members`

Library membership data (linked to Students/Users).

- **qr_code**: Unique library card QR.
- **student_id** / **user_id**: Link to person.
- **max_borrow_limit**: Borrowing quota.

### `library_loans`

Circulation records (Borrow/Return).

- **member_id**: Foreign Key to `library_members`.
- **item_id**: Foreign Key to `library_assets`.
- **borrow_date**, **due_date**, **return_date**: Transaction dates.
- **fine_amount**: Calculated fine for late return.
- **is_returned**: Boolean flag.

### `library_visits`

Log of physical visits to the library.

---

## 📦 Inventory Module

Manages school assets and supplies.

### `inventory_assets`

Fixed assets (Furniture, Electronics).

- **name**, **code**: Asset identification.
- **room_id**: Location (Foreign Key to `inventory_rooms`).
- **condition_good**, **condition_damaged**: Quantity by condition.

### `inventory_items`

Consumables (ATK, Paper).

- **name**, **code**: Item identification.
- **current_stock**: Current quantity on hand.
- **min_stock**: Reorder point.

### `inventory_transactions`

Stock movement logs (In/Out).

- **item_id**: Foreign Key to `inventory_items`.
- **type**: `IN` or `OUT`.
- **quantity**: Amount moved.

### `inventory_rooms`

Locations/Rooms in the school.

### `inventory_opname`

Stock taking events (Stock Opname).

---

## 💰 Savings (Tabungan)

Manages student savings and daily transactions.

### `tabungan_siswa`

Student savings accounts.

- **student_id**: Foreign Key to `students`.
- **saldo_terakhir**: Current balance.
- **qr_code**: Savings account QR.

### `tabungan_transaksi`

Transaction ledger (Deposit/Withdrawal).

- **siswa_id**: Foreign Key to `tabungan_siswa`.
- **tipe**: `setor` or `tarik`.
- **nominal**: Amount.
- **status**: Verification status.
- **setoran_id**: Link to daily settlement.

### `tabungan_setoran`

Daily settlement/batch deposit from Teacher to Treasurer.

- **guru_id**: Teacher submitting the money.
- **total_nominal**: System calculated total.
- **nominal_fisik**: Actual physical money received.
- **status**: `verified` by treasurer.

### `tabungan_brankas`

Treasury accounts (Cash/Bank).

- **saldo**: Current balance in the vault/bank.

---

## 💵 Finance & Loans

### `finance_accounts`

Cash accounts (e.g., "Kas Tunai", "Bank BJB").

### `finance_transactions`

General ledger for income/expense/transfers.

### `loans`

Employee loans (Kasbon/Cicilan).

- **employee_detail_id**: Borrower.
- **amount_requested**, **amount_approved**: Loan values.
- **status**: Approval status.

### `loan_installments`

Payment schedule for loans.

---

_Note: This schema is subject to change. Use `npx drizzle-kit studio` to explore the database interactively._

---

## Migrasi: status & prosedur rollback

Migrasi berada di `go-backend/internal/db/migrations/` dan di-embed ke binary
(`//go:embed *.sql`), dijalankan otomatis saat startup lewat `RunMigrations`.
Tabel `_migrations` hanya mencatat versi yang **sudah diterapkan**; runner
tidak punya mode "down".

Saat ini ada **81 file `.up.sql`** dan **63 file `.down.sql`**. Berikut 19
migrasi yang belum punya pasangan `.down.sql`:

```
000003_surat_keluar_verifikasi        000012_mutasi_tables
000004_letter_template_groups         000017_auth_improvements
000005_remove_surat_masuk_fk          000018_buku_induk_enhancements
000006_student_debt_enhancements      000019_student_class_fk
000007_alumni_buku_induk_enhancements 000020_attendance_academic_year
000008_school_documents               000021_school_settings_landing
000010_add_missing_fields             000022_fix_employee_details_user_id
000023_add_phone_to_employee_details  000024_telegram_backup_settings
000035_inventory_item_room            000048_gov_dept_name
000088_pengurus_inventaris
```

Catatan: nomor `000086` dan `000087` tidak ada (lompat), dan `000088` juga
tanpa `.down.sql`.

**Prosedur rollback yang dipakai** (bukan menjalankan `.down.sql`):

1. Hentikan container: `podman stop sekolahku-prod`.
2. Restore DB dari snapshot otomatis: `ls -1t /opt/sekolahku-prod/backups/pre-deploy.*.db | head -1`
   lalu `sqlite3 /opt/sekolahku-prod/data/sekolahku.db ".restore '<snapshot>'"`.
3. Deploy ulang commit sebelumnya (`git revert` ? `git push selfhost main`).
4. Verifikasi `http://localhost:8181/api/health` = 200.

`.down.sql` tetap dipertahankan untuk migrasi yang memang memilikinya sebagai
dokumentasi perubahan skema, tetapi **jangan** mengandalkannya sebagai jalur
rollback produksi.
