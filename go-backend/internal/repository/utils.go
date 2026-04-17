package repository

import (
	"database/sql"
	"time"
)

/**
 * SafeTime convert sql.NullInt64 (Unix seconds) to *time.Time.
 * SQLite usually stores dates as unix timestamps when coming from JS/Drizzle.
 */
func SafeTime(ni sql.NullInt64) *time.Time {
	if !ni.Valid {
		return nil
	}
	
	val := ni.Int64
	
	// Heuristic: if value > 2,000,000,000, it's likely milliseconds (year 2033 is ~2e9 seconds)
	// Most Modern JS/Drizzle DBMs use milliseconds for 'timestamp' columns.
	if val > 20000000000 {
		t := time.Unix(val/1000, (val%1000)*1000000).UTC()
		return &t
	}
	
	t := time.Unix(val, 0).UTC()
	return &t
}

/**
 * NullTime is a helper for scanning NullTimes from SQLite which might be stored as int64.
 * Use Scan into sql.NullInt64, then use this to get time.Time.
 */
func ToTime(ni sql.NullInt64) time.Time {
	ptr := SafeTime(ni)
	if ptr == nil {
		return time.Time{}
	}
	return *ptr
}

// Ptr returns a pointer to the value passed in.
func Ptr[T any](v T) *T {
	return &v
}
