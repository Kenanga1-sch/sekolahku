// ==========================================
// API Input Validation Utilities
// ==========================================
// Integrates Zod validation with Next.js API routes

import { NextRequest, NextResponse } from "next/server";
import { z, ZodError, ZodSchema } from "zod";
import { ValidationError } from "./errors";

// ==========================================
// Types
// ==========================================

export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        fields?: Record<string, string>;
    };
}

// ==========================================
// Core Validation Functions
// ==========================================

/**
 * Validate data against a Zod schema
 */
export function validateSchema<T>(
    schema: ZodSchema<T>,
    data: unknown
): ValidationResult<T> {
    try {
        const result = schema.parse(data);
        return { success: true, data: result };
    } catch (error) {
        if (error instanceof ZodError) {
            const fields: Record<string, string> = {};
            error.issues.forEach((issue) => {
                const path = issue.path.join(".");
                fields[path] = issue.message;
            });
            
            return {
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: error.issues[0]?.message || "Input tidak valid",
                    fields,
                },
            };
        }
        
        return {
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: "Input tidak valid",
            },
        };
    }
}

/**
 * Create validation error response
 */
export function validationErrorResponse(
    message: string,
    fields?: Record<string, string>
): NextResponse {
    return NextResponse.json(
        {
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message,
                fields,
            },
        },
        { status: 400 }
    );
}

// ==========================================
// API Route Helpers
// ==========================================

/**
 * Validate JSON body from request
 */
export async function validateBody<T>(
    req: NextRequest,
    schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse }> {
    try {
        const body = await req.json();
        const result = validateSchema(schema, body);
        
        if (!result.success) {
            return {
                error: validationErrorResponse(
                    result.error!.message,
                    result.error!.fields
                ),
            };
        }
        
        return { data: result.data! };
    } catch {
        return {
            error: validationErrorResponse("Request body tidak valid"),
        };
    }
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(
    req: NextRequest,
    schema: ZodSchema<T>
): { data: T } | { error: NextResponse } {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const result = validateSchema(schema, params);
    
    if (!result.success) {
        return {
            error: validationErrorResponse(
                result.error!.message,
                result.error!.fields
            ),
        };
    }
    
    return { data: result.data! };
}

/**
 * Validate path parameters
 */
export function validateParams<T>(
    params: Record<string, string | string[]>,
    schema: ZodSchema<T>
): { data: T } | { error: NextResponse } {
    const result = validateSchema(schema, params);
    
    if (!result.success) {
        return {
            error: validationErrorResponse(
                result.error!.message,
                result.error!.fields
            ),
        };
    }
    
    return { data: result.data! };
}

// ==========================================
// Wrapper for validated routes
// ==========================================

type ValidatedHandler<TBody, TQuery, TParams> = (
    req: NextRequest,
    context: {
        body: TBody;
        query: TQuery;
        params: TParams;
    }
) => Promise<NextResponse>;

interface ValidationConfig<TBody, TQuery, TParams> {
    bodySchema?: ZodSchema<TBody>;
    querySchema?: ZodSchema<TQuery>;
    paramsSchema?: ZodSchema<TParams>;
}

/**
 * Create a validated API route handler
 */
export function withValidation<
    TBody = unknown,
    TQuery = unknown,
    TParams = unknown
>(
    handler: ValidatedHandler<TBody, TQuery, TParams>,
    config: ValidationConfig<TBody, TQuery, TParams>
): (req: NextRequest, ctx?: { params: Promise<Record<string, string>> }) => Promise<NextResponse> {
    return async (req: NextRequest, ctx?: { params: Promise<Record<string, string>> }) => {
        let body: TBody = undefined as TBody;
        let query: TQuery = undefined as TQuery;
        let params: TParams = undefined as TParams;

        // Validate body
        if (config.bodySchema) {
            const result = await validateBody(req, config.bodySchema);
            if ("error" in result) {
                return result.error;
            }
            body = result.data;
        }

        // Validate query
        if (config.querySchema) {
            const result = validateQuery(req, config.querySchema);
            if ("error" in result) {
                return result.error;
            }
            query = result.data;
        }

        // Validate params
        if (config.paramsSchema && ctx?.params) {
            const awaitedParams = await ctx.params;
            const result = validateParams(awaitedParams, config.paramsSchema);
            if ("error" in result) {
                return result.error;
            }
            params = result.data;
        }

        return handler(req, { body, query, params });
    };
}

// ==========================================
// Common Validation Schemas
// ==========================================

export const CommonSchemas = {
    /** Pagination query params */
    pagination: z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(10),
    }),

    /** ID parameter */
    idParam: z.object({
        id: z.string().min(1, "ID tidak valid"),
    }),

    /** Search query */
    search: z.object({
        search: z.string().optional(),
    }),

    /** Date range */
    dateRange: z.object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
    }),
};
