import { describe, it, expect, beforeEach } from "vitest";
import { 
    getFromCache, 
    setCache, 
    deleteCache, 
    clearCache,
    getCacheMetrics,
    resetCacheMetrics,
    deleteCachePattern,
} from "./cache";

describe("Cache with LRU", () => {
    beforeEach(() => {
        clearCache();
        resetCacheMetrics();
    });

    describe("Basic Operations", () => {
        it("should set and get cached values", () => {
            setCache("test-key", { data: "value" });
            
            const result = getFromCache<{ data: string }>("test-key");
            
            expect(result).toEqual({ data: "value" });
        });

        it("should return null for non-existent keys", () => {
            const result = getFromCache("non-existent");
            
            expect(result).toBeNull();
        });

        it("should delete cache entries", () => {
            setCache("to-delete", "value");
            deleteCache("to-delete");
            
            const result = getFromCache("to-delete");
            
            expect(result).toBeNull();
        });

        it("should clear all cache entries", () => {
            setCache("key1", "value1");
            setCache("key2", "value2");
            
            clearCache();
            
            expect(getFromCache("key1")).toBeNull();
            expect(getFromCache("key2")).toBeNull();
        });

        it("should delete by pattern", () => {
            setCache("user:1", "data1");
            setCache("user:2", "data2");
            setCache("product:1", "product");
            
            deleteCachePattern("^user:");
            
            expect(getFromCache("user:1")).toBeNull();
            expect(getFromCache("user:2")).toBeNull();
            expect(getFromCache("product:1")).toBe("product");
        });
    });

    describe("Metrics", () => {
        it("should track cache hits", () => {
            setCache("hit-test", "value");
            
            getFromCache("hit-test");
            getFromCache("hit-test");
            
            const metrics = getCacheMetrics();
            expect(metrics.hits).toBe(2);
        });

        it("should track cache misses", () => {
            getFromCache("miss-1");
            getFromCache("miss-2");
            
            const metrics = getCacheMetrics();
            expect(metrics.misses).toBe(2);
        });

        it("should calculate hit rate", () => {
            setCache("hit-rate-test", "value");
            
            // 2 hits
            getFromCache("hit-rate-test");
            getFromCache("hit-rate-test");
            
            // 2 misses
            getFromCache("missing-1");
            getFromCache("missing-2");
            
            const metrics = getCacheMetrics();
            expect(metrics.hitRate).toBe(50); // 2/4 = 50%
        });

        it("should track entry count", () => {
            setCache("entry-1", "value");
            setCache("entry-2", "value");
            setCache("entry-3", "value");
            
            const metrics = getCacheMetrics();
            expect(metrics.entries).toBe(3);
        });

        it("should reset metrics", () => {
            setCache("reset-test", "value");
            getFromCache("reset-test");
            getFromCache("missing");
            
            resetCacheMetrics();
            
            const metrics = getCacheMetrics();
            expect(metrics.hits).toBe(0);
            expect(metrics.misses).toBe(0);
        });
    });

    describe("TTL Expiration", () => {
        it("should expire entries after TTL", async () => {
            // Set with 1 second TTL
            setCache("expiring", "value", 1);
            
            // Immediately available
            expect(getFromCache("expiring")).toBe("value");
            
            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            // Should be expired now
            expect(getFromCache("expiring")).toBeNull();
        });
    });

    describe("Size Tracking", () => {
        it("should track cache size", () => {
            setCache("size-test", { largeData: "x".repeat(1000) });
            
            const metrics = getCacheMetrics();
            expect(metrics.sizeBytes).toBeGreaterThan(0);
        });

        it("should update size when entries are deleted", () => {
            setCache("size-delete", { data: "x".repeat(1000) });
            const beforeDelete = getCacheMetrics().sizeBytes;
            
            deleteCache("size-delete");
            const afterDelete = getCacheMetrics().sizeBytes;
            
            expect(afterDelete).toBeLessThan(beforeDelete);
        });
    });
});
