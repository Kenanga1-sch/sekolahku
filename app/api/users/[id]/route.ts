import { db } from "@/db";
import { users, sessions, accounts, profiles } from "@/db/schema/users";
import { auditLogs, announcements } from "@/db/schema/misc";
import { tabunganKelas, tabunganTransaksi } from "@/db/schema/tabungan";
import { spmbRegistrants } from "@/db/schema/spmb";
import { inventoryAudit, inventoryTransactions } from "@/db/schema/inventory";
import { libraryMembers } from "@/db/schema/library";
import { alumniDocuments, documentPickups } from "@/db/schema/alumni";
import { teacherTp, classJournals } from "@/db/schema/curriculum";
import { disposisi, suratKeluar } from "@/db/schema/arsip";
import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, params.id),
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, role, password } = body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db.update(users).set(updateData).where(eq(users.id, params.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    // Allow both admin and superadmin to delete
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prevent self-deletion
    if (session.user.id === params.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }
    
    // Check target user role - Admin cannot delete Superadmin
    const targetUser = await db.query.users.findFirst({
        where: eq(users.id, params.id),
        columns: { role: true }
    });

    if (targetUser?.role === "superadmin" && session.user.role !== "superadmin") {
        return NextResponse.json({ error: "Admin cannot delete Super Admin" }, { status: 403 });
    }

    // Manual cleanup of related records to avoid FK constraints
    db.transaction((tx) => {
      // 1. MISC: Nullify author in announcements
      tx.update(announcements)
        .set({ authorId: null })
        .where(eq(announcements.authorId, params.id))
        .run();

      // 2. MISC: Delete audit logs
      tx.delete(auditLogs).where(eq(auditLogs.userId, params.id)).run();

      // 3. TABUNGAN: Nullify waliKelas in classes
      tx.update(tabunganKelas)
        .set({ waliKelas: null })
        .where(eq(tabunganKelas.waliKelas, params.id))
        .run();
      
      // DELETE transactions created by this user (Staff) instead of nullifying
      // because userId is NOT NULL in schema
      tx.delete(tabunganTransaksi)
        .where(eq(tabunganTransaksi.userId, params.id))
        .run();
        
      // Also nullify verifier if exists (verifiedBy is nullable)
      tx.update(tabunganTransaksi)
        .set({ verifiedBy: null })
        .where(eq(tabunganTransaksi.verifiedBy, params.id))
        .run();

      // 4. SPMB: Nullify verifiedBy in registrants
      tx.update(spmbRegistrants)
        .set({ verifiedBy: null })
        .where(eq(spmbRegistrants.verifiedBy, params.id))
        .run();

      // 5. INVENTORY: Nullify userId in audit (inventory)
      tx.update(inventoryAudit)
        .set({ userId: null })
        .where(eq(inventoryAudit.userId, params.id))
        .run();
        
      // 6. LIBRARY: Nullify userId in library members (if linked)
      tx.update(libraryMembers)
        .set({ userId: null })
        .where(eq(libraryMembers.userId, params.id))
        .run();
      
      // 7. ALUMNI: Nullify verifiedBy, uploadedBy, handedOverBy in docs
      tx.update(alumniDocuments)
        .set({ uploadedBy: null })
        .where(eq(alumniDocuments.uploadedBy, params.id))
        .run();
      
      tx.update(alumniDocuments)
        .set({ verifiedBy: null })
        .where(eq(alumniDocuments.verifiedBy, params.id))
        .run();
        
      tx.update(documentPickups)
        .set({ handedOverBy: null })
        .where(eq(documentPickups.handedOverBy, params.id))
        .run();
        
      // 8. CURRICULUM (Teacher Data) - Cascade Delete
      tx.delete(teacherTp).where(eq(teacherTp.teacherId, params.id)).run();
      tx.delete(classJournals).where(eq(classJournals.teacherId, params.id)).run();

      // 8.5 ARSIP & INVENTORY (Additional Fix)
      tx.delete(disposisi).where(
        or(
            eq(disposisi.fromUserId, params.id),
            eq(disposisi.toUserId, params.id)
        )
      ).run();
      
      tx.update(suratKeluar)
        .set({ createdBy: null })
        .where(eq(suratKeluar.createdBy, params.id))
        .run();
        
      tx.update(inventoryTransactions)
        .set({ userId: null })
        .where(eq(inventoryTransactions.userId, params.id))
        .run();

      // 9. AUTH: Delete sessions & accounts & profiles
      tx.delete(sessions).where(eq(sessions.userId, params.id)).run();
      tx.delete(accounts).where(eq(accounts.userId, params.id)).run();
      tx.delete(profiles).where(eq(profiles.userId, params.id)).run();

      // 9. Finally delete the user
      tx.delete(users).where(eq(users.id, params.id)).run();
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
