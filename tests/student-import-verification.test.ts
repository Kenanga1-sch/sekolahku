import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/master/students/bulk/route";

// Mock Auth
vi.mock("@/auth", () => ({
    auth: vi.fn(),
}));

import { auth } from "@/auth";

// Mock DB
const { mockInsert, mockInsertValues, mockSelect, mockFrom } = vi.hoisted(() => {
    const mockInsertValues = vi.fn().mockReturnThis();
    const mockInsert = vi.fn().mockReturnValue({
        values: mockInsertValues,
        onConflictDoNothing: vi.fn().mockResolvedValue({}),
    });

    const mockFrom = vi.fn().mockResolvedValue([
        { id: "class-1", name: "1A" }
    ]);
    const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom
    });

    return { mockInsert, mockInsertValues, mockSelect, mockFrom };
});

vi.mock("@/db", () => ({
    db: {
        insert: mockInsert,
        select: mockSelect,
    },
    students: {},
    studentClasses: {},
}));

describe("Bulk Student Import API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset chain mocks
        mockInsert.mockReturnValue({
             values: mockInsertValues,
             onConflictDoNothing: vi.fn().mockResolvedValue({})
        });
        mockSelect.mockReturnValue({
            from: mockFrom
        });
        mockFrom.mockResolvedValue([
            { id: "class-1", name: "1A" }
        ]);
        (auth as any).mockResolvedValue({ user: { role: "admin" } });
    });

    it("should map new fields correctly", async () => {
        const payload = {
            students: [
                {
                    fullName: "Test Student",
                    className: "1A",
                    birthPlace: "Testing City",
                    birthDate: "2010-01-01",
                    religion: "Islam",
                    address: "Test Address 123",
                    fatherName: "Father Test",
                    fatherNik: "1234567890123456",
                    motherName: "Mother Test",
                    motherNik: "6543210987654321",
                    guardianName: "Guardian Test",
                    guardianNik: "1111111111111111",
                    guardianJob: "Tester",
                    parentPhone: "08123456789"
                }
            ]
        };

        const req = new Request("http://localhost/api/master/students/bulk", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const res = await POST(req);
        
        expect(res.status).toBe(200);
        
        // Verify DB Insert was called with correct data
        expect(mockInsert).toHaveBeenCalled();
        expect(mockInsertValues).toHaveBeenCalledTimes(1);
        
        const insertedData = mockInsertValues.mock.calls[0][0];
        expect(insertedData).toHaveLength(1);
        const student = insertedData[0];

        expect(student.fullName).toBe("Test Student");
        expect(student.birthPlace).toBe("Testing City");
        expect(student.birthDate).toBe("2010-01-01");
        expect(student.religion).toBe("Islam");
        expect(student.address).toBe("Test Address 123");
        expect(student.fatherName).toBe("Father Test");
        expect(student.fatherNik).toBe("1234567890123456");
        expect(student.motherName).toBe("Mother Test");
        expect(student.guardianName).toBe("Guardian Test");
        expect(student.guardianJob).toBe("Tester");
        expect(student.parentPhone).toBe("08123456789");
    });
});
