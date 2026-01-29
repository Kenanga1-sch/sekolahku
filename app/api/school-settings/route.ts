import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { schoolSettings } from "@/db/schema/misc";
import { eq } from "drizzle-orm";

// GET - Fetch school settings
export async function GET() {
    // Default settings to return
    const defaults = {
        id: null,
        school_name: "UPTD SDN 1 Kenanga",
        school_npsn: "20211091",
        school_address: "Jl. Pendidikan No. 1, Kenanga, Sungai Penuh, Jambi",
        school_phone: "(0748) 123456",
        school_email: "sdn1kenanga@gmail.com",
        school_website: "",
        school_lat: -2.072254,
        school_lng: 101.395614,
        max_distance_km: 3,
        spmb_is_open: true,
        current_academic_year: "2025/2026",
        principal_name: "",
        principal_nip: "",
        is_maintenance: false,
        last_letter_number: 0,
        letter_number_format: "421/{nomor}/SDN1-KNG/{bulan}/{tahun}",
    };

    try {
        // Get the first (and should be only) settings row
        const [settings] = await db.select().from(schoolSettings).limit(1);
        
        if (!settings) {
            // Return default settings if none exist
            return NextResponse.json(defaults);
        }
        
        // Map to expected format
        return NextResponse.json({
            id: settings.id,
            school_name: settings.schoolName,
            school_npsn: settings.schoolNpsn,
            school_address: settings.schoolAddress,
            school_phone: settings.schoolPhone,
            school_email: settings.schoolEmail,
            school_website: settings.schoolWebsite,
            school_lat: settings.schoolLat,
            school_lng: settings.schoolLng,
            max_distance_km: settings.maxDistanceKm,
            spmb_is_open: settings.spmbIsOpen,
            current_academic_year: settings.currentAcademicYear,
            principal_name: settings.principalName,
            principal_nip: settings.principalNip,
            last_letter_number: settings.lastLetterNumber,
            letter_number_format: settings.letterNumberFormat,
        });
    } catch (error: unknown) {
        // If table doesn't exist or any SQLite error, return defaults instead of error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = (error as any)?.code;
        
        if (errorMessage.includes("no such table") || 
            errorMessage.includes("SQLITE") ||
            errorCode === "SQLITE_ERROR") {
            console.log("School settings: database issue, returning defaults");
            return NextResponse.json(defaults);
        }
        
        console.error("Failed to fetch settings:", error);
        return NextResponse.json(
            { error: "Failed to fetch settings" },
            { status: 500 }
        );
    }
}

// POST - Save school settings
export async function POST(request: NextRequest) {
    console.log("School Settings: POST request received");
    const session = await import("@/auth").then(m => m.auth());
    console.log("School Settings: Session role:", session?.user?.role);

    if (!session?.user || !["admin", "superadmin"].includes(session.user.role || "")) {
        console.log("School Settings: Unauthorized access attempt");
        return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    try {
        const body = await request.json();
        console.log("School Settings: Request body parsed", { id: body.id, schoolName: body.school_name });
        
        const data = {
            schoolName: body.school_name,
            schoolNpsn: body.school_npsn,
            schoolAddress: body.school_address,
            schoolPhone: body.school_phone,
            schoolEmail: body.school_email,
            schoolWebsite: body.school_website,
            schoolLat: body.school_lat,
            schoolLng: body.school_lng,
            maxDistanceKm: body.max_distance_km,
            spmbIsOpen: body.spmb_is_open,
            currentAcademicYear: body.current_academic_year,
            principalName: body.principal_name,
            principalNip: body.principal_nip,
            isMaintenance: body.is_maintenance,
            lastLetterNumber: body.last_letter_number,
            letterNumberFormat: body.letter_number_format,
        };
        
        let result;
        if (body.id) {
            // Update existing
            console.log("School Settings: Updating existing settings", body.id);
            const [updated] = await db.update(schoolSettings)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(schoolSettings.id, body.id))
                .returning();
            result = updated;
        } else {
            // Create new
            console.log("School Settings: Creating new settings");
            const [created] = await db.insert(schoolSettings)
                .values(data)
                .returning();
            result = created;
        }

        console.log("School Settings: Save successful", result?.id);
        return NextResponse.json({ id: result?.id, success: true });

    } catch (error) {
        console.error("SERVER ERROR SAVING SETTINGS:", error);
        return NextResponse.json(
            { error: "Failed to save settings", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
