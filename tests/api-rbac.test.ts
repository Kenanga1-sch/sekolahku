import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// 1. Mock Auth
const mockSession = { user: { id: "user1", role: "student" } };
vi.mock("@/auth", () => ({
    auth: vi.fn(),
}));

import { auth } from "@/auth";

// 2. Mock Service Layers (to avoid DB calls)
vi.mock("@/lib/inventory", () => ({
    getInventoryStats: vi.fn().mockResolvedValue({}),
    getCategoryDistribution: vi.fn().mockResolvedValue([]),
    getConditionBreakdown: vi.fn().mockResolvedValue({}),
    getTopRoomsByValue: vi.fn().mockResolvedValue([]),
    getRecentAudit: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/library", () => ({
    getLibraryItems: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    createLibraryItem: vi.fn().mockResolvedValue({ id: "book1" }),
    getActiveLoans: vi.fn().mockResolvedValue([]),
    getOverdueLoans: vi.fn().mockResolvedValue([]),
}));

// 3. Import Check Helper (Mocked implementation if needed, but we use the real one which uses mocked auth)
// We rely on the real `requireRole` in `lib/auth-checks.ts` using the mocked `auth()`.
// Warning: If `requireRole` is imported by validation targets, it will use the mocked `auth`.

// 4. Import API Handlers
// Note: We need to use `await import` in tests often if modules have side effects, 
// but here static import is fine as long as mocks are hoisted.
import { GET as getInventoryDashboard } from "@/app/api/inventory/assets/dashboard/route";
import { POST as postLibraryBook, GET as getLibraryBooks } from "@/app/api/library/books/route";
import { GET as getLibraryLoans } from "@/app/api/library/loans/route";

describe("API RBAC Security", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Inventory API", () => {
        it("should Block Unauthenticated Users (401)", async () => {
            (auth as any).mockResolvedValue(null);
            
            const req = new Request("http://localhost/api/inventory/assets/dashboard");
            const res = await getInventoryDashboard(req);
            
            expect(res.status).toBe(401);
            expect(await res.json()).toEqual({ error: "Unauthorized" });
        });

        it("should Block Unauthorized Roles (Student) (403)", async () => {
            (auth as any).mockResolvedValue({ user: { role: "siswa" } });
            
            const req = new Request("http://localhost/api/inventory/assets/dashboard");
            const res = await getInventoryDashboard(req);
            
            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error).toContain("Forbidden");
        });

        it("should Allow Authorized Roles (Admin)", async () => {
            (auth as any).mockResolvedValue({ user: { role: "admin" } });
            
            const req = new Request("http://localhost/api/inventory/assets/dashboard");
            const res = await getInventoryDashboard(req);
            
            expect(res.status).toBe(200);
        });

        it("should Allow Authorized Roles (Staff)", async () => {
            (auth as any).mockResolvedValue({ user: { role: "staff" } });
            
            const req = new Request("http://localhost/api/inventory/assets/dashboard");
            const res = await getInventoryDashboard(req);
            
            expect(res.status).toBe(200);
        });
    });

    describe("Library API", () => {
        describe("GET /books", () => {
            it("should Allow Public (Authenticated) Access", async () => {
                (auth as any).mockResolvedValue({ user: { role: "siswa" } });
                
                const req = new Request("http://localhost/api/library/books");
                const res = await getLibraryBooks(req);
                
                expect(res.status).toBe(200);
            });

            it("should Block Unauthenticated Access", async () => {
                (auth as any).mockResolvedValue(null);
                
                const req = new Request("http://localhost/api/library/books");
                const res = await getLibraryBooks(req);
                
                expect(res.status).toBe(401);
            });
        });

        describe("POST /books", () => {
            it("should Block Students (403)", async () => {
                (auth as any).mockResolvedValue({ user: { role: "siswa" } });
                
                const req = new Request("http://localhost/api/library/books", { method: "POST", body: JSON.stringify({}) });
                const res = await postLibraryBook(req);
                
                expect(res.status).toBe(403);
            });

            it("should Allow Librarian", async () => {
                (auth as any).mockResolvedValue({ user: { role: "librarian" } });
                
                const req = new Request("http://localhost/api/library/books", { method: "POST", body: JSON.stringify({}) });
                const res = await postLibraryBook(req);
                
                expect(res.status).toBe(200);
            });
        });

        describe("GET /loans", () => {
           it("should Block Students from viewing all loans (403)", async () => {
                (auth as any).mockResolvedValue({ user: { role: "siswa" } });
                
                const req = new Request("http://localhost/api/library/loans");
                const res = await getLibraryLoans(req);
                
                expect(res.status).toBe(403);
           });

           it("should Allow Admin", async () => {
                (auth as any).mockResolvedValue({ user: { role: "admin" } });
                
                const req = new Request("http://localhost/api/library/loans?type=active");
                const res = await getLibraryLoans(req);
                
                expect(res.status).toBe(200);
           });
        });
    });
});
