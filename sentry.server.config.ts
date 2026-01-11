// Sentry configuration for server-side error tracking
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "",

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Environment
    environment: process.env.NODE_ENV,

    // Only send errors in production
    enabled: process.env.NODE_ENV === "production",

    // Filter out sensitive data
    beforeSend(event) {
        // Remove any sensitive data
        if (event.request?.cookies) {
            delete event.request.cookies;
        }
        if (event.request?.headers) {
            delete event.request.headers["authorization"];
            delete event.request.headers["cookie"];
        }
        return event;
    },

    // Ignore certain errors
    ignoreErrors: [
        "ECONNREFUSED",
        "ENOTFOUND",
        "NetworkError",
    ],
});
