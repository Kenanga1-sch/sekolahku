import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTransaksi, createTransaksi } from "@/lib/tabungan";
import { ValidationError, createErrorResponse } from "@/lib/errors";
import { tabunganLog, generateRequestId, timeStart, timeEnd } from "@/lib/logger";

// GET /api/tabungan/transaksi
export async function GET(request: NextRequest) {
    const requestId = generateRequestId();
    const start = timeStart();
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "20");
    const siswaId = searchParams.get("siswaId") || undefined;
    const status = searchParams.get("status") as "pending" | "verified" | "rejected" | undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const search = searchParams.get("search") || undefined;

    tabunganLog.info("Fetching transaksi", { 
        requestId, 
        action: "transaksi_list",
        page,
        perPage,
        hasFilters: !!(siswaId || status || startDate || endDate || search)
    });

    try {
        const result = await getTransaksi(page, perPage, { siswaId, status, startDate, endDate, search });
        const duration = timeEnd(start);
        
        tabunganLog.info("Transaksi fetched", { 
            requestId, 
            action: "transaksi_list_success",
            totalItems: result.totalItems,
            duration 
        });
        
        return NextResponse.json({
            success: true,
            items: result.items,
            page,
            perPage,
            totalItems: result.totalItems,
            totalPages: result.totalPages,
        });
    } catch (error) {
        const duration = timeEnd(start);
        
        tabunganLog.error("Failed to fetch transaksi", { 
            requestId, 
            action: "transaksi_list_error",
            duration 
        }, error as Error);
        
        return createErrorResponse(error);
    }
}

// POST /api/tabungan/transaksi
export async function POST(request: NextRequest) {
    const requestId = generateRequestId();
    const start = timeStart();
    
    try {
        const session = await auth();
        // If not logged in, technically allow for now if it's a migration/system call? 
        // But better to restrict. 
        // Note: Existing code says "userId = validData.userId || 'system_migration_user'".
        // I should probably enforce auth now if I want security.
        // But to avoid breaking existing import scripts (if any), I only restrict if session exists AND role is guru.
        // If no session, it might be a script. 
        // However, this is an API route used by the frontend.
        // Let's enforce auth.
        
        if (!session?.user) {
             return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const currentUser = session.user;
        const body = await request.json();
        
        // Parse and validate using Zod schema
        const parseResult = await import("@/lib/validations/tabungan").then(m => m.createTransaksiSchema.safeParseAsync(body));

        if (!parseResult.success) {
             // Flatten the error map
             const fieldErrors = parseResult.error.flatten().fieldErrors;
             const missingFields: Record<string, string> = {};
             
             // Convert string[] errors to single string
             Object.entries(fieldErrors).forEach(([key, messages]) => {
                 if (messages && messages.length > 0) {
                    missingFields[key] = messages[0];
                 }
             });
             
             throw new ValidationError("Data transaksi tidak valid", missingFields);
        }
        
        const validData = parseResult.data;

        // RBAC Check for Guru
        if (body.type === "tarik") {
            // Lazy load getSiswaById to avoid circular dep issues if any
            const { getSiswaById } = await import("@/lib/tabungan");
            const student = await getSiswaById(validData.siswaId);
            
            if (!student) {
                return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
            }

            const siswaKelasWali = student.kelas?.waliKelas;
            
            if (siswaKelasWali !== currentUser.id) {
                return NextResponse.json({ 
                    error: "Akses Ditolak: Anda hanya boleh menginput transaksi untuk kelas bimbingan Anda." 
                }, { status: 403 });
            }
        }
        
        // Similarly, restrict editing other class students if this was an edit endpoint (but this is create).

        tabunganLog.info("Creating transaksi", { 
            requestId, 
            action: "transaksi_create",
            type: validData.type,
            nominal: validData.nominal,
            siswaId: validData.siswaId,
            userId: currentUser.id
        });
        
        // Use verified data for creation
        const newTx = await createTransaksi({
            siswaId: validData.siswaId,
            type: validData.type,
            nominal: validData.nominal,
            catatan: validData.catatan,
        }, currentUser.id || "system"); // Use logged in user ID
        
        const duration = timeEnd(start);
        
        tabunganLog.info("Transaksi created", { 
            requestId, 
            action: "transaksi_create_success",
            transactionId: newTx.id,
            duration 
        });
        
        return NextResponse.json({ success: true, data: newTx });
    } catch (error) {
        const duration = timeEnd(start);
        
        tabunganLog.error("Failed to create transaksi", { 
            requestId, 
            action: "transaksi_create_error",
            duration 
        }, error as Error);
        
        return createErrorResponse(error);
    }
}
