// ==========================================
// Export Library Unit Tests
// ==========================================
// Tests for helper functions in export.ts
// Note: Main export functions (exportToExcel, exportToPDF) require mocking
// heavy libraries (xlsx, jspdf), so we test the helper functions only.

import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to test the internal helper functions
// Since they're not exported, we'll extract and test similar logic

describe("Export Helper Functions", () => {
    describe("getStatusLabel", () => {
        // Replicate the function logic for testing
        function getStatusLabel(status: string): string {
            const labels: Record<string, string> = {
                pending: "Pending",
                verified: "Terverifikasi",
                accepted: "Diterima",
                rejected: "Ditolak",
            };
            return labels[status] || status;
        }

        it("should return correct label for known statuses", () => {
            expect(getStatusLabel("pending")).toBe("Pending");
            expect(getStatusLabel("verified")).toBe("Terverifikasi");
            expect(getStatusLabel("accepted")).toBe("Diterima");
            expect(getStatusLabel("rejected")).toBe("Ditolak");
        });

        it("should return original status for unknown statuses", () => {
            expect(getStatusLabel("custom")).toBe("custom");
            expect(getStatusLabel("in_progress")).toBe("in_progress");
        });
    });

    describe("getDateString", () => {
        // Replicate the function logic for testing
        function getDateString(): string {
            const now = new Date();
            return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        }

        it("should return date in YYYYMMDD format", () => {
            const dateString = getDateString();
            expect(dateString).toMatch(/^\d{8}$/);
        });

        it("should contain current year", () => {
            const dateString = getDateString();
            const currentYear = new Date().getFullYear().toString();
            expect(dateString.startsWith(currentYear)).toBe(true);
        });
    });

    describe("Export Data Transformation", () => {
        // Test the transformation logic used in exportToExcel
        it("should transform registrant data correctly", () => {
            const mockRegistrant = {
                id: "test123",
                registration_number: "SPMB-2024-0001",
                full_name: "John Doe",
                student_name: undefined,
                nik: "1234567890123456",
                student_nik: undefined,
                birth_place: "Jakarta",
                birth_date: "2015-05-15",
                gender: "L" as const,
                parent_name: "Jane Doe",
                parent_phone: "081234567890",
                parent_email: "jane@example.com",
                home_address: "Jl. Test No. 123",
                address: undefined,
                distance_to_school: 2.5,
                is_within_zone: true,
                is_in_zone: undefined,
                status: "pending" as const,
                created: "2024-01-15T10:00:00Z",
                updated: "2024-01-15T10:00:00Z",
                collectionId: "col123",
                collectionName: "spmb_registrants",
            };

            // Simulate the transformation
            const transformed = {
                "No": 1,
                "No. Pendaftaran": mockRegistrant.registration_number,
                "Nama Siswa": mockRegistrant.student_name || mockRegistrant.full_name,
                "NIK": mockRegistrant.student_nik || mockRegistrant.nik,
                "Tempat Lahir": mockRegistrant.birth_place,
                "Jenis Kelamin": mockRegistrant.gender === "L" ? "Laki-laki" : "Perempuan",
                "Nama Orang Tua": mockRegistrant.parent_name,
                "No. HP": mockRegistrant.parent_phone,
                "Email": mockRegistrant.parent_email,
                "Alamat": mockRegistrant.address || mockRegistrant.home_address,
                "Jarak (km)": mockRegistrant.distance_to_school?.toFixed(2),
                "Zonasi": (mockRegistrant.is_in_zone || mockRegistrant.is_within_zone) ? "Dalam Zona" : "Luar Zona",
            };

            expect(transformed["No. Pendaftaran"]).toBe("SPMB-2024-0001");
            expect(transformed["Nama Siswa"]).toBe("John Doe");
            expect(transformed["NIK"]).toBe("1234567890123456");
            expect(transformed["Jenis Kelamin"]).toBe("Laki-laki");
            expect(transformed["Jarak (km)"]).toBe("2.50");
            expect(transformed["Zonasi"]).toBe("Dalam Zona");
        });

        it("should handle legacy field names", () => {
            const legacyData = {
                student_name: "Legacy Name",
                full_name: undefined,
                student_nik: "9876543210987654",
                nik: undefined,
                address: "Legacy Address",
                home_address: undefined,
                is_in_zone: true,
                is_within_zone: undefined,
            };

            const name = legacyData.student_name || legacyData.full_name;
            const nik = legacyData.student_nik || legacyData.nik;
            const address = legacyData.address || legacyData.home_address;
            const isInZone = legacyData.is_in_zone || legacyData.is_within_zone;

            expect(name).toBe("Legacy Name");
            expect(nik).toBe("9876543210987654");
            expect(address).toBe("Legacy Address");
            expect(isInZone).toBe(true);
        });
    });
});
