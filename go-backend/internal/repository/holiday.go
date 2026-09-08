package repository

import (
	"database/sql"
	"strings"
	"time"
)

var nationalHolidays = map[string]string{
	// 2025
	"2025-01-01": "Tahun Baru 2025 Masehi",
	"2025-01-27": "Isra Mi'raj Nabi Muhammad SAW",
	"2025-01-29": "Tahun Baru Imlek 2576 Kongzili",
	"2025-03-29": "Hari Suci Nyepi Tahun Baru Saka 1947",
	"2025-03-31": "Idul Fitri 1446 Hijriah",
	"2025-04-01": "Idul Fitri 1446 Hijriah",
	"2025-04-18": "Wafat Yesus Kristus",
	"2025-05-01": "Hari Buruh Internasional",
	"2025-05-12": "Hari Raya Waisak 2569 BE",
	"2025-05-29": "Kenaikan Yesus Kristus",
	"2025-06-01": "Hari Lahir Pancasila",
	"2025-06-07": "Idul Adha 1446 Hijriah",
	"2025-06-27": "Tahun Baru Islam 1447 Hijriah",
	"2025-08-17": "Hari Kemerdekaan RI",
	"2025-09-05": "Maulid Nabi Muhammad SAW",
	"2025-12-25": "Hari Raya Natal",
	// 2026
	"2026-01-01": "Tahun Baru 2026 Masehi",
	"2026-02-17": "Tahun Baru Imlek 2577 Kongzili",
	"2026-03-19": "Hari Suci Nyepi Tahun Baru Saka 1948",
	"2026-03-20": "Idul Fitri 1447 Hijriah",
	"2026-03-21": "Idul Fitri 1447 Hijriah",
	"2026-04-03": "Wafat Yesus Kristus",
	"2026-05-01": "Hari Buruh Internasional",
	"2026-05-14": "Kenaikan Yesus Kristus",
	"2026-05-31": "Hari Raya Waisak 2570 BE",
	"2026-06-01": "Hari Lahir Pancasila",
	"2026-05-28": "Idul Adha 1447 Hijriah",
	"2026-06-17": "Tahun Baru Islam 1448 Hijriah",
	"2026-08-17": "Hari Kemerdekaan RI",
	"2026-08-26": "Maulid Nabi Muhammad SAW",
	"2026-12-25": "Hari Raya Natal",
}

var globalDB *sql.DB

func SetHolidayDB(db *sql.DB) {
	globalDB = db
}

func NationalHolidays() map[string]string {
	holidays := make(map[string]string, len(nationalHolidays))
	for date, reason := range nationalHolidays {
		holidays[date] = reason
	}
	return holidays
}

func IsHoliday(date string) (bool, string) {
	if date == "" {
		date = TodayJakarta()
	}

	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return false, ""
	}

	if t.Weekday() == time.Sunday {
		return true, "Hari Minggu"
	}

	if globalDB != nil {
		var reason string
		err := globalDB.QueryRow("SELECT COALESCE(title, description) FROM school_holidays WHERE date = ?", date).Scan(&reason)
		if err == nil && reason != "" {
			return true, reason
		}
	}

	if reason, ok := nationalHolidays[date]; ok {
		return true, reason
	}

	return false, ""
}

func IsTodayHoliday() (bool, string) {
	return IsHoliday(TodayJakarta())
}

func IsDateInList(date string) bool {
	isHoliday, _ := IsHoliday(date)
	return isHoliday
}

func GetHolidayReason(date string) string {
	_, reason := IsHoliday(date)
	return strings.TrimSpace(reason)
}