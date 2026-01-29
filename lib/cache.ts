// ==========================================
// Simple Caching Utilities
// ==========================================
// Memory-based cache for frequently accessed data
// Recommended for: Statistics, settings, small datasets
// Features: LRU eviction, size limits, metrics tracking

type CacheEntry<T> = {
    data: T;
    expiresAt: number;
    lastAccess: number;
    size: number;
};

// Configuration - Optimized for low-spec server (4GB RAM)
const MAX_CACHE_ENTRIES = 500;  // Reduced from 1000
const MAX_CACHE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB (reduced from 50MB)

// Storage
const cache = new Map<string, CacheEntry<unknown>>();

// Metrics
let cacheHits = 0;
let cacheMisses = 0;
let totalCacheSizeBytes = 0;

// ==========================================
// Metrics Functions
// ==========================================

/**
 * Get cache metrics
 */
export function getCacheMetrics(): {
    hits: number;
    misses: number;
    hitRate: number;
    entries: number;
    sizeBytes: number;
    sizeMB: number;
} {
    const total = cacheHits + cacheMisses;
    return {
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: total > 0 ? Math.round((cacheHits / total) * 100) : 0,
        entries: cache.size,
        sizeBytes: totalCacheSizeBytes,
        sizeMB: Math.round(totalCacheSizeBytes / 1024 / 1024 * 100) / 100,
    };
}

/**
 * Reset cache metrics
 */
export function resetCacheMetrics(): void {
    cacheHits = 0;
    cacheMisses = 0;
}

// ==========================================
// LRU Eviction
// ==========================================

function estimateSize(data: unknown): number {
    try {
        return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
    } catch {
        return 1024; // Default estimate for non-serializable
    }
}

function evictLRU(): void {
    if (cache.size === 0) return;
    
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of cache.entries()) {
        if (entry.lastAccess < oldestTime) {
            oldestTime = entry.lastAccess;
            oldestKey = key;
        }
    }
    
    if (oldestKey) {
        const entry = cache.get(oldestKey);
        if (entry) {
            totalCacheSizeBytes -= entry.size;
        }
        cache.delete(oldestKey);
    }
}

function evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (now > entry.expiresAt) {
            totalCacheSizeBytes -= entry.size;
            cache.delete(key);
        }
    }
}

function ensureCapacity(newSize: number): void {
    // First, evict expired entries
    evictExpired();
    
    // Evict LRU until we have space
    while (cache.size >= MAX_CACHE_ENTRIES || 
           totalCacheSizeBytes + newSize > MAX_CACHE_SIZE_BYTES) {
        if (cache.size === 0) break;
        evictLRU();
    }
}

// ==========================================
// Core Cache Functions
// ==========================================

/**
 * Get cached value if not expired
 */
export function getFromCache<T>(key: string): T | null {
    const entry = cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
        cacheMisses++;
        return null;
    }
    
    if (Date.now() > entry.expiresAt) {
        totalCacheSizeBytes -= entry.size;
        cache.delete(key);
        cacheMisses++;
        return null;
    }
    
    // Update last access time for LRU
    entry.lastAccess = Date.now();
    cacheHits++;
    
    return entry.data;
}

/**
 * Set cache value with TTL in seconds
 */
export function setCache<T>(key: string, data: T, ttlSeconds: number = 60): void {
    const size = estimateSize(data);
    
    // Remove existing entry if present
    const existing = cache.get(key);
    if (existing) {
        totalCacheSizeBytes -= existing.size;
    }
    
    // Ensure we have capacity
    ensureCapacity(size);
    
    const now = Date.now();
    cache.set(key, {
        data,
        expiresAt: now + ttlSeconds * 1000,
        lastAccess: now,
        size,
    });
    totalCacheSizeBytes += size;
}

/**
 * Delete specific cache key
 */
export function deleteCache(key: string): void {
    const entry = cache.get(key);
    if (entry) {
        totalCacheSizeBytes -= entry.size;
    }
    cache.delete(key);
}

/**
 * Delete all cache keys matching pattern
 */
export function deleteCachePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const [key, entry] of cache.entries()) {
        if (regex.test(key)) {
            totalCacheSizeBytes -= entry.size;
            cache.delete(key);
        }
    }
}

/**
 * Clear all cache
 */
export function clearCache(): void {
    cache.clear();
    totalCacheSizeBytes = 0;
}

// ==========================================
// Cache Helper with Fetch
// ==========================================

interface CacheOptions {
    ttlSeconds?: number;
    forceRefresh?: boolean;
}

/**
 * Get cached data or fetch from source
 */
export async function getCachedOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
): Promise<T> {
    const { ttlSeconds = 60, forceRefresh = false } = options;
    
    if (!forceRefresh) {
        const cached = getFromCache<T>(key);
        if (cached !== null) {
            return cached;
        }
    }
    
    const data = await fetchFn();
    setCache(key, data, ttlSeconds);
    return data;
}

// ==========================================
// Predefined Cache Keys
// ==========================================

export const CacheKeys = {
    // Library
    LIBRARY_STATS: "library:stats",
    LIBRARY_CATEGORIES: "library:categories",
    
    // SPMB
    SPMB_ACTIVE_PERIOD: "spmb:active_period",
    SPMB_STATS: "spmb:stats",
    
    // Tabungan
    TABUNGAN_STATS: "tabungan:stats",
    
    // Settings
    SCHOOL_SETTINGS: "school:settings",
    
    // Helpers
    libraryItem: (id: string) => `library:item:${id}`,
    libraryMember: (id: string) => `library:member:${id}`,
    tabunganSiswa: (id: string) => `tabungan:siswa:${id}`,
} as const;

// ==========================================
// Cache TTL Constants
// ==========================================

export const CacheTTL = {
    SHORT: 30,       // 30 seconds
    MEDIUM: 300,     // 5 minutes
    LONG: 3600,      // 1 hour
    VERY_LONG: 86400 // 24 hours
} as const;

// ==========================================
// SWR Cache Invalidation Helpers
// ==========================================

/**
 * Get mutate keys for SWR revalidation
 * Usage with useSWR: mutate(getMutateKey.libraryItems(search))
 */
export const getMutateKey = {
    libraryItems: (search?: string) => 
        `/api/perpustakaan/data?type=items${search ? `&search=${search}` : ""}`,
    libraryMembers: (search?: string) => 
        `/api/perpustakaan/data?type=members${search ? `&search=${search}` : ""}`,
    libraryLoans: () => "/api/perpustakaan/data?type=loans",
    libraryStats: () => "/api/perpustakaan/stats",
    tabunganSiswa: (kelasId?: string) =>
        `/api/tabungan/siswa${kelasId ? `?kelasId=${kelasId}` : ""}`,
    tabunganTransaksi: (siswaId?: string) =>
        `/api/tabungan/transaksi${siswaId ? `?siswaId=${siswaId}` : ""}`,
    spmbRegistrants: (status?: string) =>
        `/api/spmb/register${status ? `?status=${status}` : ""}`,
} as const;

// ==========================================
// Query Debounce Helper  
// ==========================================

const debounceTimers = new Map<string, NodeJS.Timeout>();

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    key: string,
    fn: T,
    delayMs: number = 300
): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
        const existing = debounceTimers.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        
        const timer = setTimeout(() => {
            fn(...args);
            debounceTimers.delete(key);
        }, delayMs);
        
        debounceTimers.set(key, timer);
    };
}
