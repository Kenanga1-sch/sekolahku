import { NextResponse } from "next/server";
import { db, users, employeeDetails } from "@/db";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
// No explicit hash import in this file scope, assuming bcryptjs is used elsewhere or let's import it
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data } = await req.json();

        if (!Array.isArray(data) || data.length === 0) {
             return NextResponse.json({ error: "Data kosong" }, { status: 400 });
        }

        let successCount = 0;
        let errors: string[] = [];

        // Pre-hash password for efficiency (all same default)
        const defaultPasswordHash = await bcrypt.hash("123456", 10);

        // Process sequentially to avoid race conditions/locks on SQLite
        interface EmployeeImportRow {
            Email?: string;
            NamaLengkap?: string;
            Role?: string;
            NoHP?: string;
            NIP?: string;
            NUPTK?: string;
            NIK?: string;
            StatusKepegawaian?: string;
            JenisPTK?: string;
            TanggalMasuk?: string;
        }

        for (const [index, row] of (data as EmployeeImportRow[]).entries()) {
             const rowNum = index + 1;
             
             // Helper to clean input
             const sanitize = (val: string | number | null | undefined): string | null => {
                 if (val === null || val === undefined) return null;
                 const str = String(val).trim();
                 return str === "" ? null : str;
             };

             const email = sanitize(row.Email);
             const fullName = sanitize(row.NamaLengkap);

             if (!email || !fullName) {
                 errors.push(`Baris ${rowNum}: Email atau Nama kosong.`);
                 continue;
             }

             // Check existing email
             const existingUser = await db.query.users.findFirst({
                 where: eq(users.email, email)
             });

             if (existingUser) {
                 // Skip if exists
                 errors.push(`Baris ${rowNum}: Email ${email} sudah ada (Dilewati).`);
                 continue;
             }
             
             try {
                await db.transaction(async (tx) => {
                    const [newUser] = await tx.insert(users).values({
                         name: fullName,
                         fullName: fullName,
                         email: email,
                         role: (sanitize(row.Role) || "guru") as "guru" | "admin" | "superadmin" | "staff", 
                         phone: sanitize(row.NoHP),
                         passwordHash: defaultPasswordHash,
                         emailVerified: new Date(),
                         createdAt: new Date(),
                         updatedAt: new Date(), 
                    }).returning();

                    await tx.insert(employeeDetails).values({
                        userId: newUser.id,
                        nip: sanitize(row.NIP),
                        nuptk: sanitize(row.NUPTK),
                        nik: sanitize(row.NIK),
                        employmentStatus: sanitize(row.StatusKepegawaian) || "GTY",
                        jobType: sanitize(row.JenisPTK) || "Guru Mapel",
                        joinDate: sanitize(row.TanggalMasuk),
                        updatedAt: new Date(),
                    }).run();
                });
                successCount++;
             } catch (err) {
                 console.error(err);
                 errors.push(`Baris ${rowNum}: Gagal simpan - ${err instanceof Error ? err.message : "Unknown error"}`);
             }
        }

        return NextResponse.json({ success: true, successCount, errors });

    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
    }
}
