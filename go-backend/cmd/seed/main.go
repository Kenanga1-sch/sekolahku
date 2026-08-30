package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "modernc.org/sqlite"
	"golang.org/x/crypto/bcrypt"

	"github.com/nrednav/cuid2"
)

// Seed data untuk pengecekan modul: users (guru/bendahara), kelas, 26 siswa,
// tabungan + transaksi + setoran pending, hutang, brankas, perpustakaan,
// pengaturan sekolah, dan SPMB demo.
// Siswa hanya masuk ke tabel students — rekening tabungan & keanggotaan
// perpustakaan dibuat lewat pola extension-row (menguji arsitektur single-source).
// Idempotent: aman dijalankan berulang.

func main() {
	dbPath := "../data/sekolahku.db"
	if len(os.Args) > 1 {
		dbPath = os.Args[1]
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal("DB error:", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatal("Ping error:", err)
	}

	now := time.Now().UnixMilli()
	const day = int64(24 * 60 * 60 * 1000)

	// ============ 1. USERS (guru & bendahara) ============
	seedUser := func(id, name, email, username, pass, role string) {
		hash, _ := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
		_, err := db.Exec(`INSERT OR IGNORE INTO users (id, name, email, username, password_hash, role, full_name, is_active, must_change_password, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
			id, name, email, username, string(hash), role, name, now, now)
		if err != nil {
			log.Fatal("seed user gagal:", err)
		}
		fmt.Println("  user:", username, "/", pass, "("+role+")")
	}
	seedUser("user-guru", "Bu Sari Wati", "guru@sekolah.sch.id", "guru", "guru123", "guru")
	seedUser("user-bendahara", "Pak Dana Santoso", "bendahara@sekolah.sch.id", "bendahara", "bendahara123", "bendahara")

	// ============ 2. KELAS ============
	type kelas struct {
		id, name string
		grade     int
		teacher   string
	}
	kelasList := []kelas{
		{"cls-1a", "Kelas 1A", 1, "Bu Sari Wati"},
		{"cls-2a", "Kelas 2A", 2, "Bu Sari Wati"},
		{"cls-3a", "Kelas 3A", 3, "Pak Dana Santoso"},
		{"cls-4a", "Kelas 4A", 4, "Bu Sari Wati"},
		{"cls-5a", "Kelas 5A", 5, "Pak Dana Santoso"},
		{"cls-6a", "Kelas 6A", 6, "Bu Sari Wati"},
	}
	for _, k := range kelasList {
		_, err := db.Exec(`INSERT OR IGNORE INTO student_classes (id, name, grade, academic_year, teacher_name, capacity, is_active, created_at, updated_at)
			VALUES (?, ?, ?, '2025/2026', ?, 32, 1, ?, ?)`,
			k.id, k.name, k.grade, k.teacher, now, now)
		if err != nil {
			log.Fatal("seed kelas gagal:", err)
		}
	}
	fmt.Println("  kelas: 6 (1A-6A)")

	// ============ 3. SISWA (26: 24 aktif + 2 nonaktif) ============
	type siswa struct {
		nisn, nis, name, gender, birth, class string
		active                                bool
	}
	nama := []string{
		"Ahmad Fauzi", "Bunga Citra", "Candra Wijaya", "Dewi Lestari",
		"Eko Prasetyo", "Fitri Handayani", "Gilang Ramadhan", "Hana Salsabila",
		"Irfan Maulana", "Joko Susilo", "Kirana Putri", "Lukman Hakim",
		"Maya Anggraini", "Nanda Pratama", "Oki Setiawan", "Putri Ayu",
		"Qori Ananda", "Rizky Hidayat", "Siti Nurhaliza", "Taufik Hidayat",
		"Umi Kalsum", "Vino Bastian", "Wulan Sari", "Yoga Pratama",
		"Zaki Abdurrahman", "Zahra Amelia",
	}
	kelasSeq := []string{"cls-1a", "cls-2a", "cls-3a", "cls-4a", "cls-5a", "cls-6a"}

	studentIDs := make([]string, 0, len(nama))
	for i, nm := range nama {
		id := fmt.Sprintf("stu-%03d", i+1)
		studentIDs = append(studentIDs, id)
		active := i < 24 // 2 terakhir nonaktif (mutasi keluar)
		status := "active"
		isActive := 1
		if !active {
			status = "mutasi_keluar"
			isActive = 0
		}
		birth := fmt.Sprintf("20%02d-%02d-%02d", 19-(i/6), (i%12)+1, (i%28)+1)
		address := fmt.Sprintf("Jl. Kenanga No. %d, Indramayu", i+1)
		phone := fmt.Sprintf("08123456%04d", i+1)
		_, err := db.Exec(`INSERT OR IGNORE INTO students
			(id, nik, nisn, nis, full_name, gender, birth_place, birth_date, religion, address,
			 parent_name, parent_phone, class_name, class_id, status, qr_code, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, 'Indramayu', ?, 'Islam', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id,
			fmt.Sprintf("3204%012d", i+1),
			fmt.Sprintf("00%08d", 10000000+i),
			fmt.Sprintf("N%04d", i+1),
			nm,
			[]string{"L", "P"}[i%2],
			birth,
			address,
			"Orang Tua "+nm,
			phone,
			fmt.Sprintf("Kelas %dA", (i%6)+1),
			kelasSeq[i%6],
			status,
			fmt.Sprintf("QR-STU-%03d", i+1),
			isActive, now, now)
		if err != nil {
			log.Fatal("seed siswa gagal:", err)
		}
	}
	fmt.Printf("  siswa: %d (24 aktif + 2 mutasi keluar)\n", len(nama))

	// ============ 4. EXTENSION ROWS (single-source pattern, sama seperti server) ============
	for i, id := range studentIDs {
		if i >= 24 {
			continue // siswa nonaktif tidak dapat rekening
		}
		db.Exec(`INSERT OR IGNORE INTO tabungan_siswa (id, student_id, saldo_terakhir, created_at, updated_at)
			VALUES (?, ?, 0, ?, ?)`, "sav-"+id, id, now, now)
		db.Exec(`INSERT OR IGNORE INTO library_members (id, student_id, user_id, max_borrow_limit, is_active, created_at, updated_at)
			VALUES (?, ?, NULL, 3, 1, ?, ?)`, "lib-"+id, id, now, now)
	}

	// ============ 5. TRANSAKSI TABUNGAN (saldo via transaksi verified) ============
	// Siswa 1-5: saldo besar; 6-10: kecil; 11-12: nol; 13: khusus pending setoran
	type txSeed struct {
		idx       int // 0-based index siswa
		tipe      string
		nominal   int
		daysAgo   int
	}
	txSeeds := []txSeed{}
	for i := 0; i < 5; i++ { // siswa 1-5: 3x setor
		txSeeds = append(txSeeds,
			txSeed{i, "setor", 50000, 20},
			txSeed{i, "setor", 25000, 12},
			txSeed{i, "setor", 25000, 5},
		)	}
	for i := 5; i < 10; i++ { // siswa 6-10: 1 setor kecil
		txSeeds = append(txSeeds, txSeed{i, "setor", 10000, 8})
	}
	// siswa 13 & 14: setor + tarik
	txSeeds = append(txSeeds,
		txSeed{12, "setor", 40000, 15},
		txSeed{12, "tarik", 15000, 9},
		txSeed{13, "setor", 30000, 11},
		txSeed{13, "tarik", 30000, 6},
	)
	// siswa 15: setor pending di setoran (collected, belum diverifikasi)
	txSeeds = append(txSeeds, txSeed{14, "setor", 20000, 1})

	for _, t := range txSeeds {
		id := cuid2.Generate()
		_, err := db.Exec(`INSERT OR IGNORE INTO tabungan_transaksi (id, siswa_id, user_id, tipe, nominal, status, catatan, verified_by, verified_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, studentIDs[t.idx], "user-guru", t.tipe, t.nominal, "verified",
			"Setoran awal seed", "user-bendahara", now-int64(t.daysAgo)*day, now-int64(t.daysAgo)*day, now-int64(t.daysAgo)*day)
		if err != nil {
			log.Fatal("seed transaksi gagal:", err)
		}
	}
	// Hitung saldo akhir per siswa dari transaksi verified
	_, err = db.Exec(`UPDATE tabungan_siswa SET saldo_terakhir = (
			SELECT COALESCE(SUM(CASE WHEN tipe = 'setor' THEN nominal ELSE -nominal END), 0)
			FROM tabungan_transaksi t
			WHERE t.siswa_id = tabungan_siswa.student_id AND t.status = 'verified'
		)`)
	if err != nil {
		log.Fatal("update saldo gagal:", err)
	}

	// Setoran pending (guru menyetor, menunggu verifikasi bendahara)
	var pendingCount int
	db.QueryRow(`SELECT COUNT(*) FROM tabungan_setoran WHERE status = 'pending'`).Scan(&pendingCount)
	if pendingCount == 0 {
		setoranID := "setoran-pending-1"
		_, err := db.Exec(`INSERT INTO tabungan_setoran (id, guru_id, tipe, total_nominal, status, catatan, created_at, updated_at)
			VALUES (?, ?, 'setor_ke_bendahara', 20000, 'pending', 'Setoran uang kas kelas (seed)', ?, ?)`,
			setoranID, "user-guru", now-day, now-day)
		if err != nil {
			log.Fatal("seed setoran gagal:", err)
		}
		db.Exec(`UPDATE tabungan_transaksi SET setoran_id = ? WHERE status = 'collected'`, setoranID)
		// pastikan transaksi siswa 15 berstatus collected (bagian setoran)
		db.Exec(`UPDATE tabungan_transaksi SET status = 'collected', setoran_id = ? WHERE siswa_id = ? AND tipe = 'setor' AND nominal = 20000`,
			setoranID, studentIDs[14])
		// hitung ulang saldo: transaksi collected belum masuk saldo
		db.Exec(`UPDATE tabungan_siswa SET saldo_terakhir = (
			SELECT COALESCE(SUM(CASE WHEN tipe = 'setor' THEN nominal ELSE -nominal END), 0)
			FROM tabungan_transaksi t
			WHERE t.siswa_id = tabungan_siswa.student_id AND t.status = 'verified'
		)`)
	}
	fmt.Println("  tabungan: rekening + transaksi verified + 1 setoran pending")

	// ============ 6. HUTANG ============
	_, _ = db.Exec(`INSERT OR IGNORE INTO tabungan_hutang (id, siswa_id, nama_barang, kategori, nominal, jumlah, terbayar, dicatat_oleh, status, created_at, updated_at)
		VALUES ('hutang-1', ?, 'Buku Tulis', 'ATK', 3500, 2, 0, 'user-bendahara', 'aktif', ?, ?)`,
		studentIDs[5], now-6*day, now-6*day)
	_, _ = db.Exec(`INSERT OR IGNORE INTO tabungan_hutang (id, siswa_id, nama_barang, kategori, nominal, jumlah, terbayar, dicatat_oleh, status, created_at, updated_at)
		VALUES ('hutang-2', ?, 'Seragam Olahraga', 'Pakaian', 85000, 1, 85000, 'user-bendahara', 'lunas', ?, ?)`,
		studentIDs[6], now-15*day, now-15*day)
	fmt.Println("  hutang: 2 (1 aktif, 1 lunas)")

	// ============ 7. BRANKAS ============
	_, _ = db.Exec(`INSERT OR IGNORE INTO tabungan_brankas (id, nama, tipe, saldo, updated_at)
		VALUES ('brankas-cash', 'Kas Utama', 'cash', 1250000, ?)`, now)
	fmt.Println("  brankas: Kas Utama saldo 1.250.000")

	// ============ 8. PERPUSTAKAAN ============
	type buku struct {
		isbn, title, author, publisher, year, category string
	}
	bukuList := []buku{
		{"978-602-1234-01", "Laskar Pelangi", "Andrea Hirata", "Bentang Pustaka", "2005", "fiksi"},
		{"978-602-1234-02", "Si Kancil dan Buaya", "Kumpulan Dongeng Nusantara", "Gramedia", "2010", "anak"},
		{"978-602-1234-03", "Kamus Besar Bahasa Indonesia", "Badan Bahasa", "Balai Pustaka", "2016", "referensi"},
		{"978-602-1234-04", "Matematika SD Kelas 4", "Tim Kemdikbud", "Erlangga", "2021", "pelajaran"},
		{"978-602-1234-05", "Ensiklopedia Sains Anak", "Tim Sains", "Tiga Serangkai", "2018", "sains"},
		{"978-602-1234-06", "Malin Kundang", "Dongeng Rakyat", "Pustaka Yani", "2008", "anak"},
		{"978-602-1234-07", "Bumi Manusia", "Pramoedya A. Toer", "Hasta Mitra", "1980", "fiksi"},
		{"978-602-1234-08", "Atlas Indonesia", "Tim Geografi", "Erlangga", "2019", "referensi"},
	}
	for i, b := range bukuList {
		catID := fmt.Sprintf("cat-%02d", i+1)
		db.Exec(`INSERT OR IGNORE INTO library_catalog (id, isbn, title, author, publisher, year, category, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, catID, b.isbn, b.title, b.author, b.publisher, b.year, b.category, now, now)
		copies := 1
		if i < 3 {
			copies = 2 // 3 buku pertama punya 2 eksemplar → total 11 eksemplar
		}
		for c := 0; c < copies; c++ {
			assetID := fmt.Sprintf("ast-%02d-%d", i+1, c+1)
			db.Exec(`INSERT OR IGNORE INTO library_assets (id, catalog_id, status, location, condition, created_at, updated_at)
				VALUES (?, ?, 'AVAILABLE', 'Rak A?', 'Baik', ?, ?)`, assetID, catID, now, now)
		}
	}
	// Pinjaman aktif: siswa 1 (belum telat), siswa 2 (telat)
	_, _ = db.Exec(`INSERT OR IGNORE INTO library_loans (id, member_id, item_id, borrow_date, due_date, is_returned, status, fine_amount, fine_paid, created_at, updated_at)
		VALUES ('loan-1', ?, 'ast-01-1', ?, ?, 0, 'borrowed', 0, 0, ?, ?)`,
		"lib-"+studentIDs[0], now-5*day, now+2*day, now-5*day, now-5*day)
	_, _ = db.Exec(`INSERT OR IGNORE INTO library_loans (id, member_id, item_id, borrow_date, due_date, is_returned, status, fine_amount, fine_paid, created_at, updated_at)
		VALUES ('loan-2', ?, 'ast-02-1', ?, ?, 0, 'borrowed', 2000, 0, ?, ?)`,
		"lib-"+studentIDs[1], now-12*day, now-5*day, now-12*day, now-12*day)
	db.Exec(`UPDATE library_assets SET status = 'BORROWED' WHERE id IN ('ast-01-1', 'ast-02-1')`)
	// Riwayat pinjaman selesai (siswa 3)
	_, _ = db.Exec(`INSERT OR IGNORE INTO library_loans (id, member_id, item_id, borrow_date, due_date, return_date, is_returned, status, fine_amount, fine_paid, created_at, updated_at)
		VALUES ('loan-3', ?, 'ast-03-1', ?, ?, ?, 1, 'returned', 0, 1, ?, ?)`,
		"lib-"+studentIDs[2], now-20*day, now-13*day, now-14*day, now-20*day, now-14*day)
	fmt.Println("  perpustakaan: 8 judul, 11 eksemplar, 2 pinjaman aktif (1 telat), 1 riwayat")

	// ============ 9. PENGATURAN SEKOLAH ============
	_, _ = db.Exec(`UPDATE school_settings SET
		school_name = 'SDN 1 Kenanga',
		school_address = 'Jl. Raya Kenanga No. 1, Indramayu',
		school_phone = '0231-123456',
		school_email = 'info@sdn1kenanga.sch.id',
		school_lat = -6.3275,
		school_lng = 108.3208,
		current_academic_year = '2025/2026',
		spmb_is_open = 1,
		principal_name = 'Ibu Kepala Sekolah, M.Pd.'
		WHERE id = 'default' OR id = (SELECT id FROM school_settings LIMIT 1)`)

	// ============ 10. SPMB DEMO ============
	var spmbCount int
	db.QueryRow(`SELECT COUNT(*) FROM spmb_periods`).Scan(&spmbCount)
	if spmbCount == 0 {
		db.Exec(`INSERT INTO spmb_periods (id, name, year, academic_year, committee_name, start_date, end_date, status, quota, created_at, updated_at)
			VALUES ('spmb-period-2026', 'SPMB 2026/2027', '2026', '2026/2027', 'Panitia PPDB SDN 1 Kenanga', ?, ?, 'active', 40, ?, ?)`,
			now-10*day, now+30*day, now, now)

		type pendaftar struct {
			regNum, name, nisn, birth, status string
		}
		pendaftarList := []pendaftar{
			{"SPMB-2026-0001", "Aditya Nugraha", "0099123456", "2019-05-12", "pending"},
			{"SPMB-2026-0002", "Bella Safira", "0099123457", "2019-08-23", "verified"},
			{"SPMB-2026-0003", "Cakra Dwi", "0099123458", "2020-01-07", "rejected"},
		}
		for i, p := range pendaftarList {
			db.Exec(`INSERT OR IGNORE INTO spmb_registrants
				(id, registration_number, full_name, nisn, student_nik, birth_place, birth_date, gender, religion, address_street, address_village,
				 parent_name, parent_phone, father_name, mother_name, status, is_active, period_id, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, 'Indramayu', ?, ?, 'Islam', ?, 'Kenanga',
				 ?, ?, ?, ?, ?, 1, 'spmb-period-2026', ?, ?)`,
				cuid2.Generate(), p.regNum, p.name, p.nisn,
				fmt.Sprintf("320499990000%04d", i+1),
				p.birth,
				[]string{"L", "P"}[i%2],
				fmt.Sprintf("Jl. Melati No. %d", i+1),
				"Orang Tua "+p.name,
				fmt.Sprintf("0812345678%02d", i+1),
				"Ayah "+p.name,
				"Ibu "+p.name,
				p.status, now, now)
			_ = i
		}
		fmt.Println("  spmb: 1 periode + 3 pendaftar (pending/verified/rejected)")
	}

	// ============ 11. PENGUMUMAN (untuk halaman publik) ============
	var annCount int
	db.QueryRow(`SELECT COUNT(*) FROM announcements`).Scan(&annCount)
	if annCount == 0 {
		db.Exec(`INSERT INTO announcements (id, title, slug, content, excerpt, category, status, view_count, is_published, published_at, created_at, updated_at)
			VALUES ('ann-1', 'Pembagian Rapor Semester Ganjil', 'pembagian-rapor-ganjil',
			 '<p>Pembagian rapor semester ganjil akan dilaksanakan pada hari Jumat di masing-masing kelas.</p>',
			 'Pembagian rapor semester ganjil dilaksanakan Jumat di kelas masing-masing.',
			 'pengumuman', 'published', 0, 1, ?, ?, ?)`, now, now, now)
		db.Exec(`INSERT INTO announcements (id, title, slug, content, excerpt, category, status, view_count, is_published, published_at, created_at, updated_at)
			VALUES ('ann-2', 'Libur Awal Ramadan', 'libur-awal-ramadan',
			 '<p>Sekolah diliburkan selama tiga hari pertama Ramadan sesuai kalender pendidikan.</p>',
			 'Libur tiga hari pertama Ramadan.', 'pengumuman', 'published', 0, 1, ?, ?, ?)`, now, now, now)
		fmt.Println("  pengumuman: 2 (untuk halaman publik)")
	}

	fmt.Println("\nSEED SELESAI.")
	fmt.Println("Login tambahan: guru/guru123, bendahara/bendahara123")
}
