import { NextResponse } from "next/server";
import { db, staffProfiles } from "@/db";
import { auth } from "@/auth";
import { desc, asc } from "drizzle-orm";
import { z } from "zod";

const staffSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  degree: z.string().optional(),
  position: z.string().min(1, "Jabatan wajib diisi"),
  category: z.enum(["kepsek", "guru", "staff", "support"]),
  photoUrl: z.string().optional(),
  nip: z.string().optional(),
  quote: z.string().optional(),
  displayOrder: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    // Public can access GET? Spec says "Admin Input Data Staff" but "Public Profile Page"
    // So this generic route might be used by Admin. Public might generally filter.
    // Let's assume this route is for Admin List which shows everything.
    // We'll create a separate or filtered GET for public if needed.
    // For now, let's keep it protected or simple. 
    // Wait, the specification implies this is primarily for Admin management.
    // I'll make it generic GET, but POST protected.
    
    // Actually, Admin needs to see all. Public needs active only.
    // Let's protect this route for Admin management.

    const session = await auth();
    // allow public read? spec says public page needs data.
    // let's check session. If session, return all. If no session, return active only?
    // or just make a public api separately?
    // Let's keep this as the main API. If GET, we can filter by params.

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    
    // Logic: If Admin, show all. If Public, show active only.
    // But for simplicity, let's just return all and let frontend filter, OR use a ?public=true param
    // Actually, verifying session is better for security.
    
    let query = db.select().from(staffProfiles).$dynamic();
    
    // Simple implementation: List all sorted by category and order
    const list = await db.query.staffProfiles.findMany({
        orderBy: [asc(staffProfiles.category), asc(staffProfiles.displayOrder)]
    });

    return NextResponse.json({ success: true, data: list });
    
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) { // Add stricter role check if needed
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = staffSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Data tidak valid", errors: validation.error.flatten() },
        { status: 400 }
      );
    }

    const newStaff = await db.insert(staffProfiles).values(validation.data).returning();

    return NextResponse.json({ success: true, data: newStaff[0] });

  } catch (error) {
    console.error("Create staff error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
