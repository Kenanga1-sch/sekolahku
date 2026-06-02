package repository

import (
	"database/sql"
	"time"
)

/**
 * SafeTime convert sql.NullInt64 (Unix milliseconds) to *time.Time.
 * We standardize on Milliseconds for high precision and consistency with JS.
 */
func SafeTime(ni sql.NullInt64) *time.Time {
	if !ni.Valid || ni.Int64 == 0 {
		return nil
	}
	
	val := ni.Int64
	
	// Heuristic: if value > 20,000,000,000, it's definitely milliseconds.
	// Year 2033 in seconds is ~2e9.
	if val > 20000000000 {
		t := time.Unix(val/1000, (val%1000)*1000000).UTC()
		return &t
	}
	
	// Fallback for legacy seconds
	t := time.Unix(val, 0).UTC()
	return &t
}

/**
 * UnixMilli returns current time in Unix Milliseconds.
 * Use this for all new 'created_at' and 'updated_at' fields.
 */
func UnixMilli() int64 {
	return time.Now().UnixMilli()
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
