import { NextRequest, NextResponse } from "next/server";
import { 
    getRegistrantByRegistrationNumber,
    getActivePeriod
} from "@/lib/spmb";
import { 
    ValidationError, 
    NotFoundError, 
    createErrorResponse 
} from "@/lib/errors";
import { spmbLog, generateRequestId, timeStart, timeEnd } from "@/lib/logger";

export async function GET(request: NextRequest) {
    const requestId = generateRequestId();
    const start = timeStart();
    
    try {
        const { searchParams } = new URL(request.url);
        const registrationNumber = searchParams.get("number");

        spmbLog.info("Checking SPMB status", { 
            requestId, 
            action: "spmb_status_check",
            registrationNumber 
        });

        if (!registrationNumber) {
            throw new ValidationError("Nomor pendaftaran harus diisi", {
                number: "Nomor pendaftaran wajib diisi"
            });
        }

        // Validate format (SPMB-YYYY-XXXX)
        if (!/^SPMB-\d{4}-\d{4}$/.test(registrationNumber)) {
            throw new ValidationError(
                "Format nomor pendaftaran tidak valid (contoh: SPMB-2024-0001)",
                { number: "Format tidak valid" }
            );
        }

        const registrant = await getRegistrantByRegistrationNumber(registrationNumber);

        if (!registrant) {
            throw new NotFoundError("Pendaftaran");
        }

        // Get period info
        const period = await getActivePeriod();

        // Map status to Indonesian
        const statusMap: Record<string, string> = {
            draft: "Draft",
            pending: "Menunggu Verifikasi",
            verified: "Terverifikasi",
            accepted: "Diterima",
            rejected: "Ditolak",
        };

        const duration = timeEnd(start);
        spmbLog.info("SPMB status found", { 
            requestId, 
            action: "spmb_status_found",
            status: registrant.status,
            duration 
        });

        return NextResponse.json({
            success: true,
            data: {
                registration_number: registrant.registrationNumber,
                student_name: registrant.fullName,
                status: registrant.status,
                status_label: statusMap[registrant.status || "pending"] || registrant.status,
                is_in_zone: registrant.isInZone,
                distance_to_school: registrant.distanceToSchool,
                registered_at: registrant.createdAt?.toISOString(),
                period_name: period?.name || "Unknown Period",
                notes: registrant.notes || null,
            },
        });
    } catch (error) {
        const duration = timeEnd(start);
        
        if (error instanceof ValidationError || error instanceof NotFoundError) {
            spmbLog.warn("SPMB status check failed", { 
                requestId, 
                action: "spmb_status_error",
                errorCode: (error as any).code,
                duration 
            });
        } else {
            spmbLog.error("SPMB status check error", { 
                requestId, 
                action: "spmb_status_error",
                duration 
            }, error as Error);
        }
        
        return createErrorResponse(error);
    }
}
