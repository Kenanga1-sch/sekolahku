package repository

import "time"

// ==========================================
// Zona waktu bersama: WIB (Asia/Jakarta)
// ==========================================
// Semua modul memakai jam yang sama supaya "hari ini" tidak bergeser
// saat server berjalan di zona waktu lain (mis. UTC di container).
//
// ponytail: satu zona untuk satu sekolah; kalau nanti multi-zona,
// simpan offset per sekolah di school_settings.

var jakartaLoc = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return time.FixedZone("WIB", 7*3600)
	}
	return loc
}()

// JakartaLoc lokasi WIB (untuk handler yang butuh time.Location eksplisit).
func JakartaLoc() *time.Location { return jakartaLoc }

// NowJakarta waktu sekarang dalam zona WIB.
func NowJakarta() time.Time {
	return time.Now().In(jakartaLoc)
}

// TodayJakarta tanggal hari ini (YYYY-MM-DD) menurut jam WIB.
func TodayJakarta() string {
	return NowJakarta().Format("2006-01-02")
}

// CurrentYearJakarta tahun berjalan menurut jam WIB.
func CurrentYearJakarta() int {
	return NowJakarta().Year()
}

// JakartaMidnight mengembalikan awal hari (00:00) tanggal tertentu dalam WIB, sebagai Unix milli.
// Date kosong/invalid -> awal hari ini.
func JakartaMidnight(date string) int64 {
	if t, err := time.ParseInLocation("2006-01-02", date, jakartaLoc); err == nil {
		return t.UnixMilli()
	}
	y, m, d := NowJakarta().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, jakartaLoc).UnixMilli()
}
