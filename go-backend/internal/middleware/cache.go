package middleware

import (
	"sync"
	"time"
)

type cacheEntry struct {
	data      []byte
	expiresAt time.Time
}

var (
	cacheMap = sync.Map{}
	mu       sync.Mutex
)

func CacheGet(key string) ([]byte, bool) {
	val, ok := cacheMap.Load(key)
	if !ok {
		return nil, false
	}
	entry := val.(cacheEntry)
	if time.Now().After(entry.expiresAt) {
		cacheMap.Delete(key)
		return nil, false
	}
	return entry.data, true
}

func CacheSet(key string, data []byte, ttl time.Duration) {
	cacheMap.Store(key, cacheEntry{data: data, expiresAt: time.Now().Add(ttl)})
}

func CacheInvalidate(prefix string) {
	mu.Lock()
	defer mu.Unlock()
	cacheMap.Range(func(key, value interface{}) bool {
		if k, ok := key.(string); ok && len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			cacheMap.Delete(key)
		}
		return true
	})
}

func CacheClear() {
	cacheMap.Range(func(key, _ interface{}) bool {
		cacheMap.Delete(key)
		return true
	})
}
