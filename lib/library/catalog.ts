// ==========================================
// Library Catalog & ISBN Lookup
// ==========================================
import "server-only";

import { db } from "@/db";
import { libraryCatalog, libraryAssets } from "@/db/schema/library";
import { eq, sql } from "drizzle-orm";
import { revalidateLibraryStats } from "@/lib/data/library";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { pipeline } from "stream";
import type { LibraryCatalog, LibraryAsset } from "@/types/library";

const streamPipeline = promisify(pipeline);

/**
 * Downloads an image from a URL and saves it to the local covers directory.
 */
export async function downloadCoverImage(url: string, isbn: string): Promise<string | null> {
    if (!url || !isbn) return null;

    try {
        const directory = path.join(process.cwd(), "public/uploads/library/covers");
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        const extension = url.split(".").pop()?.split("?")[0] || "jpg";
        const filename = `${isbn}.${extension}`;
        const filePath = path.join(directory, filename);
        const publicPath = `/uploads/library/covers/${filename}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        if (!response.body) throw new Error("Response body is empty");

        if (response.body) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await streamPipeline(response.body as any, fs.createWriteStream(filePath));
        }

        return publicPath;
    } catch (error) {
        console.error("Error downloading cover image:", error);
        return null;
    }
}

/**
 * Get or create a catalog entry by ISBN.
 */
export async function getOrCreateCatalog(data: Partial<LibraryCatalog>): Promise<LibraryCatalog> {
    if (data.isbn) {
        const [existing] = await db.select().from(libraryCatalog).where(eq(libraryCatalog.isbn, data.isbn)).limit(1);
        
        if (existing) {
            if (data.category && data.category !== "UNSORTED" && existing.category !== data.category) {
                const [updated] = await db.update(libraryCatalog)
                    .set({ 
                        category: data.category,
                        updatedAt: new Date() 
                    })
                    .where(eq(libraryCatalog.id, existing.id))
                    .returning();
                return updated as LibraryCatalog;
            }
            return existing as LibraryCatalog;
        }
    }

    const [newCatalog] = await db.insert(libraryCatalog).values({
        title: data.title || "Tanpa Judul",
        author: data.author || "Unknown",
        isbn: data.isbn,
        publisher: data.publisher,
        year: data.year,
        category: data.category || "UNSORTED",
        description: data.description,
        cover: data.cover || "/images/placeholder-book.png",
    }).returning();

    if (newCatalog && data.cover && data.cover.startsWith("http") && data.isbn) {
        const localPath = await downloadCoverImage(data.cover, data.isbn);
        if (localPath) {
            const [updated] = await db.update(libraryCatalog)
                .set({ cover: localPath, updatedAt: new Date() })
                .where(eq(libraryCatalog.id, newCatalog.id))
                .returning();
            return updated as LibraryCatalog;
        }
    }

    await revalidateLibraryStats();
    return newCatalog as LibraryCatalog;
}

/**
 * Bind a physical QR code to a catalog entry
 */
export async function bindAsset(qrCode: string, catalogId: string, location?: string): Promise<LibraryAsset> {
    const [asset] = await db.insert(libraryAssets).values({
        id: qrCode,
        catalogId,
        location,
        status: "AVAILABLE",
        condition: "Baik",
    }).returning();

    await revalidateLibraryStats();
    return asset as LibraryAsset;
}

/**
 * Swap a damaged QR code with a new one, preserving history
 */
export async function swapAssetCode(oldQr: string, newQr: string): Promise<LibraryAsset> {
    const { libraryLoans } = await import("@/db/schema/library");
    
    return db.transaction(async (tx) => {
        const rows = await tx.select().from(libraryAssets).where(eq(libraryAssets.id, oldQr)).limit(1);
        const oldAsset = rows[0];
        if (!oldAsset) throw new Error("Asset lama tidak ditemukan");

        const [newAsset] = await tx.insert(libraryAssets).values({
            ...oldAsset,
            id: newQr,
            updatedAt: new Date(),
        }).returning();

        await tx.update(libraryLoans)
            .set({ itemId: newQr })
            .where(eq(libraryLoans.itemId, oldQr));

        tx.delete(libraryAssets).where(eq(libraryAssets.id, oldQr)).run();

        return newAsset as LibraryAsset;
    });
}

/**
 * Lookup book metadata by ISBN from external APIs
 */
export async function lookupISBN(isbn: string) {
    const [local] = await db.select().from(libraryCatalog).where(eq(libraryCatalog.isbn, isbn)).limit(1);
    
    const { mapToDDC } = await import("@/lib/library/ddc-mapping");

    if (local) {
        const [countResult] = await db.select({ count: sql<number>`count(*)` })
            .from(libraryAssets)
            .where(eq(libraryAssets.catalogId, local.id));
            
        return {
            title: local.title,
            author: local.author,
            publisher: local.publisher,
            year: local.year,
            cover: local.cover,
            isbn: local.isbn,
            ddcCategory: local.category,
            localFound: true,
            totalExemplars: countResult.count,
            description: local.description,
        };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const googleRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`, { signal: controller.signal });
        const googleData = await googleRes.json();
        clearTimeout(timeoutId);

        if (googleData.totalItems > 0) {
            const b = googleData.items[0].volumeInfo;
            const subjects = b.categories || [];
            const ddcCategory = mapToDDC(subjects);

            let coverUrl = b.imageLinks?.extraLarge || b.imageLinks?.large || b.imageLinks?.medium || b.imageLinks?.thumbnail;
            if (coverUrl && coverUrl.includes("zoom=1")) {
                coverUrl = coverUrl.replace("zoom=1", "zoom=2");
            } else if (coverUrl && !coverUrl.includes("zoom=")) {
                coverUrl += coverUrl.includes("?") ? "&zoom=2" : "?zoom=2";
            }

            return {
                title: b.title,
                author: b.authors?.[0] || "Unknown",
                publisher: b.publisher,
                year: b.publishedDate ? parseInt(b.publishedDate.substring(0, 4)) : undefined,
                cover: coverUrl,
                isbn: isbn,
                subjects,
                ddcCategory,
                localFound: false,
                totalExemplars: 0,
                source: "Google Books",
                description: b.description,
            };
        }

        // Fallback to OpenLibrary
        const olController = new AbortController();
        const olTimeoutId = setTimeout(() => olController.abort(), 6000);

        const olRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, { signal: olController.signal });
        const olData = await olRes.json();
        clearTimeout(olTimeoutId);
        
        const bookKey = `ISBN:${isbn}`;

        if (olData[bookKey]) {
            const b = olData[bookKey];
            const subjects: string[] = [];
            if (b.subjects) subjects.push(...b.subjects.map((s: { name: string } | string) => (typeof s === 'object' && s !== null && 'name' in s ? s.name : s)));
            if (b.subject_places) subjects.push(...b.subject_places.map((s: { name: string } | string) => (typeof s === 'object' && s !== null && 'name' in s ? s.name : s)));
            
            const ddcCategory = mapToDDC(subjects);

            return {
                title: b.title,
                author: b.authors?.[0]?.name || "Unknown",
                publisher: b.publishers?.[0]?.name,
                year: b.publish_date ? parseInt(b.publish_date.match(/\d{4}/)?.[0] || "0") : undefined,
                cover: b.cover?.large || b.cover?.medium,
                isbn: isbn,
                subjects,
                ddcCategory,
                localFound: false,
                totalExemplars: 0,
                source: "OpenLibrary",
            };
        }

        return null;
    } catch (e) {
        if (e.name === "AbortError") {
            console.warn(`ISBN lookup for ${isbn} timed out`);
        } else {
            console.error("ISBN lookup failed", e);
        }
        return null;
    }
}
