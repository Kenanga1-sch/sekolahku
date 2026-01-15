// ==========================================
// Generic CRUD Helper Factory
// ==========================================
// This module provides a factory function to create
// type-safe CRUD operations for any PocketBase collection,
// reducing code duplication across modules.

import { getPocketBase } from "./pocketbase";
import type { RecordModel } from "pocketbase";

// Base record with common fields
export interface BaseRecord extends RecordModel {
    id: string;
    created: string;
    updated: string;
}

// Generic list result
export interface ListResult<T> {
    items: T[];
    totalItems: number;
    totalPages: number;
}

// Options for list queries
export interface ListOptions {
    page?: number;
    perPage?: number;
    filter?: string;
    sort?: string;
    expand?: string;
    fields?: string;
}

/**
 * Creates a type-safe CRUD helper for a PocketBase collection
 * @param collectionName - Name of the PocketBase collection
 * @returns Object with CRUD methods
 */
export function createCollectionHelper<T extends BaseRecord>(collectionName: string) {
    const pb = getPocketBase();
    const collection = () => pb.collection(collectionName);

    return {
        /**
         * Get paginated list of records
         */
        async getList(options: ListOptions = {}): Promise<ListResult<T>> {
            const { page = 1, perPage = 20, filter = "", sort = "-created", expand, fields } = options;

            const result = await collection().getList<T>(page, perPage, {
                filter,
                sort,
                expand,
                fields,
            });

            return {
                items: result.items,
                totalItems: result.totalItems,
                totalPages: result.totalPages,
            };
        },

        /**
         * Get all records (use with caution for large collections)
         */
        async getAll(options: Omit<ListOptions, 'page' | 'perPage'> = {}): Promise<T[]> {
            const { filter, sort = "-created", expand, fields } = options;
            return await collection().getFullList<T>({ filter, sort, expand, fields });
        },

        /**
         * Get single record by ID
         */
        async getOne(id: string, expand?: string): Promise<T | null> {
            try {
                return await collection().getOne<T>(id, { expand });
            } catch {
                return null;
            }
        },

        /**
         * Get first record matching filter
         */
        async getFirst(filter: string, expand?: string): Promise<T | null> {
            try {
                return await collection().getFirstListItem<T>(filter, { expand });
            } catch {
                return null;
            }
        },

        /**
         * Create new record
         */
        async create(data: Partial<T>): Promise<T> {
            return await collection().create<T>(data);
        },

        /**
         * Update existing record
         */
        async update(id: string, data: Partial<T>): Promise<T> {
            return await collection().update<T>(id, data);
        },

        /**
         * Delete record by ID
         */
        async delete(id: string): Promise<boolean> {
            try {
                await collection().delete(id);
                return true;
            } catch {
                return false;
            }
        },

        /**
         * Count records matching filter
         */
        async count(filter?: string): Promise<number> {
            const result = await collection().getList(1, 1, { filter });
            return result.totalItems;
        },

        /**
         * Raw collection accessor for advanced queries
         */
        raw: collection,
    };
}

/**
 * Helper to create audit log entries
 * Usage: const auditHelper = createAuditHelper('inventory_audit')
 */
export function createAuditHelper(collectionName: string) {
    const pb = getPocketBase();
    const collection = () => pb.collection(collectionName);

    return {
        async log(
            action: string,
            entity: string,
            entityId: string,
            changes?: unknown,
            note?: string
        ): Promise<void> {
            try {
                const userId = pb.authStore.model?.id;
                if (!userId) return;

                await collection().create({
                    user: userId,
                    action,
                    entity,
                    entity_id: entityId,
                    changes,
                    note,
                });
            } catch (error) {
                console.error(`Audit log failed for ${collectionName}:`, error);
            }
        },
    };
}
