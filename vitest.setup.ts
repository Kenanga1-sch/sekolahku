import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import * as React from "react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: (props: React.ComponentProps<"div">) => React.createElement("div", props),
    span: (props: React.ComponentProps<"span">) => React.createElement("span", props),
    section: (props: React.ComponentProps<"section">) => React.createElement("section", props),
    article: (props: React.ComponentProps<"article">) => React.createElement("article", props),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));
