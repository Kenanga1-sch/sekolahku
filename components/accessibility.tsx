"use client";

/**
 * Skip to Content Link
 * Accessible navigation for keyboard and screen reader users
 * 
 * Usage: Add <SkipToContent /> at the top of your layout
 * And add id="main-content" to your main content area
 */
export function SkipToContent() {
    return (
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
            Skip to main content
        </a>
    );
}

/**
 * Screen Reader Only Text
 * Provides context for screen readers without visual display
 */
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
    return <span className="sr-only">{children}</span>;
}

/**
 * Keyboard Trap Component
 * Traps focus within a container (useful for modals)
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>) {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Tab" || !containerRef.current) return;

        const focusableElements = containerRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
        }
    };

    return { handleKeyDown };
}

/**
 * Announce to Screen Readers
 * Programmatically announce content to screen readers
 */
export function announce(message: string, priority: "polite" | "assertive" = "polite") {
    const el = document.createElement("div");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", priority);
    el.setAttribute("aria-atomic", "true");
    el.className = "sr-only";
    el.textContent = message;

    document.body.appendChild(el);

    setTimeout(() => {
        document.body.removeChild(el);
    }, 1000);
}
