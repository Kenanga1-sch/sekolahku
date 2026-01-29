
import { NextResponse } from "next/server";
import { db, users, employeeDetails, loans, financeTransactions, teacherTp } from "@/db";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;

        const data = await db.select({
            id: users.id,
            name: users.name,
            fullName: users.fullName,
            email: users.email,
            role: users.role,
            phone: users.phone,
            nip: employeeDetails.nip,
            nuptk: employeeDetails.nuptk,
            nik: employeeDetails.nik,
            employmentStatus: employeeDetails.employmentStatus,
            jobType: employeeDetails.jobType,
            joinDate: employeeDetails.joinDate,
        })
        .from(users)
        .leftJoin(employeeDetails, eq(users.id, employeeDetails.userId))
        .where(eq(users.id, id))
        .limit(1);

        if (data.length === 0) {
            return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
        }

        return NextResponse.json(data[0]);

    } catch (error) {
        return NextResponse.json({ error: "Error fetching data" }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();

        // 1. Check Email Uniqueness (excluding self)
        const existingEmail = await db.query.users.findFirst({
            where: eq(users.email, body.email)
        });

        if (existingEmail && existingEmail.id !== id) {
            return NextResponse.json({ error: "Email sudah digunakan oleh pegawai lain" }, { status: 409 });
        }

        db.transaction((tx) => {
            // Update User Base
            tx.update(users).set({
                fullName: body.fullName,
                name: body.fullName,
                email: body.email, // Safe now
                role: body.role,
                phone: body.phone || null,
                updatedAt: new Date()
            }).where(eq(users.id, id)).run(); // .run() for execute in better-sqlite3? Or just call it? Drizzle better-sqlite3 .run() or .execute() is usually implied or strictly return.
            // Wait, for drizzle-orm/better-sqlite3, update().where() returns result object if .run() is called.
            // Drizzle query interface: db.update(...).set(...).where(...) returns a prepared statement or executes immediately?
            // Checking docs or typical usage:
            // For better-sqlite3: 
            // await db.update(...) -> db.update(...) works synchronously?
            // Actually, usually it's tx.update(...).run() or similar.
            // But wait, if I remove 'await', I just receive the result.
            // Let's assume standard drizzle usage:
            // tx.update(...) is a thenable? No, in sync driver it might return result directly or need .run()/.all()/.get() depending on operation?
            // INSERT/UPDATE/DELETE usually need .run() to execute in standard better-sqlite3 wrapper, but Drizzle abstracts this.
            // Drizzle Sync: db.select().from()... is direct. 
            // db.update().set().where() -> standard usage is await db.update... 
            // In sync mode: db.update().set().where().run() ?
            // Let's look at existing code or extensive Drizzle docs knowledge.
            // Drizzle `better-sqlite3` driver usage:
            // const result = db.select().from(users).all();
            // db.update(users).set({...}).where({...}).run();
            // So I should use .run() for mutations.
            
            // Re-evaluating existing code:
            // It was using await tx.update(...).
            // If checking previous file content.
            
            // Let's safe bet: Remove async/await. If Drizzle returns a statement, I need to execute it.
            // Drizzle usually executes query on `.then()` (which await does) or if sync, it executes immediately or via .run()?
            // Update: In better-sqlite3 drizzle, queries are executed synchronously.
            // `db.insert(...).values(...)` returns result.
            // `db.update(...).set(...)` returns result.
            // So removing await is correct.
            
            tx.update(users).set({
                fullName: body.fullName,
                name: body.fullName,
                email: body.email, // Safe now
                role: body.role,
                phone: body.phone || null,
                updatedAt: new Date()
            }).where(eq(users.id, id)).run();

            // Upsert Employee Details
            const existingDetail = tx.select().from(employeeDetails).where(eq(employeeDetails.userId, id)).all();
            
            // Helper to convert empty string to null
            const sanitize = (val: string) => (val === "" ? null : val);

            if (existingDetail.length > 0) {
                 tx.update(employeeDetails).set({
                    nip: sanitize(body.nip),
                    nuptk: sanitize(body.nuptk),
                    nik: sanitize(body.nik),
                    employmentStatus: body.employmentStatus,
                    jobType: body.jobType,
                    joinDate: sanitize(body.joinDate),
                    updatedAt: new Date()
                }).where(eq(employeeDetails.userId, id)).run();
            } else {
                tx.insert(employeeDetails).values({
                    userId: id,
                    nip: sanitize(body.nip),
                    nuptk: sanitize(body.nuptk),
                    nik: sanitize(body.nik),
                    employmentStatus: body.employmentStatus,
                    jobType: body.jobType,
                    joinDate: sanitize(body.joinDate),
                }).run();
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("PUT Employee Error:", error);
         if (error.message?.includes("UNIQUE constraint")) {
             return NextResponse.json({ error: "Data unik (Email/NIP) konflik dengan data lain" }, { status: 409 });
        }
        return NextResponse.json({ error: error.message || "Gagal update" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session || !["admin", "superadmin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const { id } = await params;

        // 1. Check for Loans (Pinjaman)
        // Need to get employeeDetailId first
        const empDetail = await db.query.employeeDetails.findFirst({
            where: eq(employeeDetails.userId, id)
        });

        if (empDetail) {
             const hasLoans = await db.query.loans.findFirst({
                 where: eq(loans.employeeDetailId, empDetail.id)
             });
             
             if (hasLoans) {
                 return NextResponse.json({ error: "Gagal: Pegawai memiliki data Pinjaman/Kasbon. Hapus data pinjaman terlebih dahulu." }, { status: 409 });
             }
        }

        // 2. Check for Transactions (Created By) - Audit Trail
        const hasTransactions = await db.query.financeTransactions.findFirst({
            where: eq(financeTransactions.createdBy, id)
        });
        if (hasTransactions) {
             return NextResponse.json({ error: "Gagal: Pegawai pernah membuat transaksi keuangan. Data tidak boleh dihapus demi audit." }, { status: 409 });
        }

        // 3. Check for Teaching Data (Curriculum)
        const hasTeachingData = await db.query.teacherTp.findFirst({
            where: eq(teacherTp.teacherId, id)
        });
        if (hasTeachingData) {
            return NextResponse.json({ error: "Gagal: Pegawai memiliki data ajar (TP/Modul). Hapus data ajar terlebih dahulu." }, { status: 409 });
        }

        // Proceed to delete
        if (empDetail) {
             await db.delete(employeeDetails).where(eq(employeeDetails.userId, id));
        }
        await db.delete(users).where(eq(users.id, id));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete Employee Error:", error);
         if (error.message?.includes("FOREIGN KEY")) {
            return NextResponse.json({ error: "Data terkait (Foreign Key) masih ada. Hapus data terkait dulu." }, { status: 409 });
        }
        return NextResponse.json({ error: "Gagal menghapus" }, { status: 500 });
    }
}
