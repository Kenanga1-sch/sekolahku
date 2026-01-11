// Sentry configuration for client-side error tracking
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Session replay for debugging
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Environment
    environment: process.env.NODE_ENV,

    // Only send errors in production
    enabled: process.env.NODE_ENV === "production",

    // Filter out sensitive data
    beforeSend(event) {
        // Remove any sensitive data from the event
        if (event.request?.cookies) {
            delete event.request.cookies;
        }
        if (event.request?.headers) {
            // Remove auth headers
            delete event.request.headers["authorization"];
            delete event.request.headers["cookie"];
        }
        return event;
    },

    // Ignore certain errors
    ignoreErrors: [
        // Browser extensions
        "top.GLOBALS",
        "ResizeObserver loop",
        "Loading chunk",
        // Network errors that we can't do anything about
        "NetworkError",
        "Failed to fetch",
        "Load failed",
        // User-caused errors
        "AbortError",
    ],
});
