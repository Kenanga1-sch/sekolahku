package repository

import (
	"strings"
	"testing"
	"time"
)

// Jam WIB harus konsisten terlepas dari timezone server.
func TestTodayJakartaConsistent(t *testing.T) {
	// Simulasi server di UTC pukul 01:00 → WIB sudah 08:00 (tanggal sama atau besok, bukan kemarin)
	utcMorning := time.Date(2026, 9, 1, 1, 0, 0, 0, time.UTC)
	wib := utcMorning.In(jakartaLoc)
	if wib.Format("2006-01-02") != "2026-09-01" {
		t.Fatalf("01:00 UTC harus 08:00 WIB tanggal sama, got %s", wib.Format("2006-01-02"))
	}

	// 17:00 UTC = 00:00 WIB hari berikutnya
	utcEvening := time.Date(2026, 9, 1, 17, 0, 0, 0, time.UTC)
	wib2 := utcEvening.In(jakartaLoc)
	if wib2.Format("2006-01-02") != "2026-09-02" {
		t.Fatalf("17:00 UTC harus sudah 02 Sept WIB, got %s", wib2.Format("2006-01-02"))
	}
}

func TestJakartaMidnight(t *testing.T) {
	m := JakartaMidnight("2026-09-01")
	parsed := time.UnixMilli(m).In(jakartaLoc)
	if parsed.Hour() != 0 || parsed.Minute() != 0 || parsed.Second() != 0 {
		t.Fatalf("harus tepat tengah malam WIB, got %v", parsed)
	}
	if parsed.Format("2006-01-02") != "2026-09-01" {
		t.Fatalf("tanggal salah: %s", parsed.Format("2006-01-02"))
	}
	// input sampah -> awal hari ini, tidak panic
	if JakartaMidnight("bukan-tanggal") == 0 {
		t.Fatal("input invalid harus fallback, bukan 0")
	}
}

func TestCurrentYearJakarta(t *testing.T) {
	if CurrentYearJakarta() < 2026 {
		t.Fatalf("tahun berjalan tidak masuk akal: %d", CurrentYearJakarta())
	}
	if !strings.Contains(TodayJakarta(), "-") {
		t.Fatalf("TodayJakarta harus format YYYY-MM-DD: %s", TodayJakarta())
	}
}
