
import { NextResponse } from "next/server";
import { db, users, employeeDetails } from "@/db";
import { auth } from "@/auth";
import { eq, like, or, and, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

// GET: List Employees
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const q = searchParams.get("q") || "";

        const offset = (page - 1) * limit;

        const conditions = [];
        conditions.push(or(eq(users.role, "guru"), eq(users.role, "admin"), eq(users.role, "staff"))); // Only staff roles

        if (q) {
            conditions.push(or(
                like(users.name, `%${q}%`),
                like(users.email, `%${q}%`),
                like(employeeDetails.nip, `%${q}%`),
                like(employeeDetails.nuptk, `%${q}%`)
            ));
        }

        const query = db.select({
            id: users.id, // User ID
            name: users.name,
            fullName: users.fullName,
            email: users.email,
            role: users.role,
            nip: employeeDetails.nip,
            nuptk: employeeDetails.nuptk,
            employmentStatus: employeeDetails.employmentStatus,
            jobType: employeeDetails.jobType,
            userId: employeeDetails.userId, // Link check
        })
        .from(users)
        .leftJoin(employeeDetails, eq(users.id, employeeDetails.userId))
        .where(and(...conditions))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(users.createdAt));

        const data = await query;
        
        // Count total
        const totalQuery = await db.select({ count: sql<number>`count(*)` })
            .from(users)
            .leftJoin(employeeDetails, eq(users.id, employeeDetails.userId))
            .where(and(...conditions));
        
        const total = totalQuery[0].count;

        return NextResponse.json({
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Error fetching employees:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST: Create New Employee (User + Detail)
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        
        // Validate required
        if (!body.email || !body.fullName || !body.role) {
             return NextResponse.json({ error: "Email, Nama, dan Role wajib diisi" }, { status: 400 });
        }

        // Transaction
        const passwordHash = await bcrypt.hash("123456", 10); // Default password

        db.transaction((tx) => {
            // 1. Create User
            const newUser = tx.insert(users).values({
                email: body.email,
                name: body.fullName,
                fullName: body.fullName,
                role: body.role, // guru, admin, staff
                phone: body.phone || null,
                passwordHash: passwordHash,
                createdAt: new Date(),
                updatedAt: new Date(),
            }).returning().get();

            const userId = newUser.id;

            // Helper to convert empty string to null
            const sanitize = (val: any) => (val === "" || val === undefined ? null : val);

            // 2. Create Detail
            tx.insert(employeeDetails).values({
                userId: userId,
                nip: sanitize(body.nip),
                nuptk: sanitize(body.nuptk),
                nik: sanitize(body.nik),
                employmentStatus: body.employmentStatus || "GTY", 
                jobType: body.jobType || "Guru Mapel",
                joinDate: sanitize(body.joinDate)
            }).run();
        });

        return NextResponse.json({ success: true, message: "Pegawai berhasil ditambahkan (Password: 123456)" });

    } catch (error: any) {
        console.error("Error creating employee:", error);
        if (error.message?.includes("UNIQUE constraint")) {
             return NextResponse.json({ error: "Email atau NIP/NUPTK sudah terdaftar" }, { status: 409 });
        }
        return NextResponse.json({ error: "Gagal menyimpan data" }, { status: 500 });
    }
}
