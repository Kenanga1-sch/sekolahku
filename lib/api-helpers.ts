// ==========================================
// API Helpers - Standardized Response & Error Handling
// ==========================================
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { AppError, createErrorResponse, RateLimitError } from "./errors";
import { logger, generateRequestId } from "./logger";
import { checkRateLimit, RateLimitConfig, RateLimitPresets } from "./rate-limit";

export type ApiContext = {
    params?: Record<string, string>;
};

export type AuthenticatedRequest = {
    request: NextRequest;
    session: NonNullable<Awaited<ReturnType<typeof auth>>>;
    params?: Record<string, string>;
};

// ==========================================
// Response Helpers
// ==========================================

/**
 * Create standardized success response
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
    return NextResponse.json({ success: true, data }, { status });
}

/**
 * Create paginated success response
 */
export function paginatedResponse<T>(
    items: T[],
    totalItems: number,
    page: number,
    perPage: number
): NextResponse {
    return NextResponse.json({
        success: true,
        data: items,
        pagination: {
            page,
            perPage,
            totalItems,
            totalPages: Math.ceil(totalItems / perPage),
        },
    });
}

/**
 * Create empty success response (204 No Content style but with JSON)
 */
export function emptySuccess(): NextResponse {
    return NextResponse.json({ success: true });
}

// ==========================================
// API Handler Wrappers
// ==========================================

type HandlerFn<T = unknown> = (
    request: NextRequest,
    context?: ApiContext
) => Promise<NextResponse | T>;

type AuthHandlerFn<T = unknown> = (
    ctx: AuthenticatedRequest
) => Promise<NextResponse | T>;

/**
 * Get client IP from request headers
 */
function getClientIP(request: NextRequest): string {
    return request.headers.get("x-forwarded-for")?.split(",")[0] || 
           request.headers.get("x-real-ip") || 
           "unknown";
}

/**
 * Wrap API handler with error handling and optional rate limiting
 */
export function apiHandler<T>(
    handler: HandlerFn<T>,
    options: {
        rateLimit?: RateLimitConfig;
    } = {}
) {
    return async (request: NextRequest, context?: ApiContext): Promise<NextResponse> => {
        const startTime = Date.now();
        const requestId = generateRequestId();
        
        try {
            // Rate limiting
            if (options.rateLimit) {
                const ip = getClientIP(request);
                const { allowed, remaining, resetIn } = checkRateLimit(ip, options.rateLimit);
                
                if (!allowed) {
                    logger.warn("Rate limit exceeded", { ip, requestId });
                    throw new RateLimitError(resetIn);
                }
                
                // Add rate limit headers
                const response = await executeHandler();
                response.headers.set("X-RateLimit-Remaining", String(remaining));
                response.headers.set("X-RateLimit-Reset", String(resetIn));
                return response;
            }
            
            return await executeHandler();
            
        } catch (error) {
            logger.error("API error", { 
                requestId, 
                error: error instanceof Error ? error.message : String(error),
                path: request.nextUrl.pathname,
                method: request.method,
                duration: Date.now() - startTime,
            }, error instanceof Error ? error : undefined);
            
            return createErrorResponse(error);
        }
        
        async function executeHandler(): Promise<NextResponse> {
            const result = await handler(request, context);
            
            // Log successful request
            logger.info("API request", {
                requestId,
                path: request.nextUrl.pathname,
                method: request.method,
                duration: Date.now() - startTime,
            });
            
            if (result instanceof NextResponse) {
                return result;
            }
            return successResponse(result);
        }
    };
}

/**
 * Wrap API handler that requires authentication
 */
export function authHandler<T>(
    handler: AuthHandlerFn<T>,
    options: {
        roles?: string[];
        rateLimit?: RateLimitConfig;
    } = {}
) {
    return apiHandler(async (request, context) => {
        const session = await auth();
        
        if (!session?.user) {
            throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
        }
        
        if (options.roles && options.roles.length > 0) {
            const userRole = session.user.role as string;
            if (!options.roles.includes(userRole)) {
                throw new AppError("Forbidden", 403, "FORBIDDEN");
            }
        }
        
        const result = await handler({
            request,
            session,
            params: context?.params,
        });
        
        if (result instanceof NextResponse) {
            return result;
        }
        return successResponse(result);
    }, options);
}

// ==========================================
// Request Parsing Helpers
// ==========================================

/**
 * Safely parse JSON body
 */
export async function parseBody<T>(request: NextRequest): Promise<T> {
    try {
        return await request.json();
    } catch {
        throw new AppError("Invalid JSON body", 400, "INVALID_JSON");
    }
}

/**
 * Get query parameter with type coercion
 */
export function getQueryParam(
    request: NextRequest,
    key: string,
    defaultValue?: string
): string | undefined {
    return request.nextUrl.searchParams.get(key) || defaultValue;
}

/**
 * Get numeric query parameter
 */
export function getNumericParam(
    request: NextRequest,
    key: string,
    defaultValue: number
): number {
    const value = request.nextUrl.searchParams.get(key);
    const parsed = value ? parseInt(value, 10) : NaN;
    return isNaN(parsed) ? defaultValue : parsed;
}

// Re-export rate limit presets for convenience
export { RateLimitPresets };
