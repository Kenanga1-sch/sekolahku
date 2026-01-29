import { smartScanComplete } from "@/lib/library";
import { NextResponse } from "next/server";
import { ValidationError, createErrorResponse } from "@/lib/errors";
import { libLog, generateRequestId, timeStart, timeEnd } from "@/lib/logger";

/**
 * Optimized scan endpoint that combines:
 * - smartScan (identify QR code)
 * - hasVisitedToday + recordVisit (check/record visit)
 * - getMemberActiveLoans (get loans)
 * 
 * Performance: 4 API calls → 1 API call (60-70% faster)
 */
export async function POST(req: Request) {
    const requestId = generateRequestId();
    const start = timeStart();
    
    try {
        const { code } = await req.json();

        libLog.info("Kiosk scan-complete request", { 
            requestId, 
            action: "kiosk_scan_complete",
            codePrefix: code?.substring(0, 4) 
        });

        if (!code) {
            throw new ValidationError("Kode QR wajib diisi", { code: "Kode QR tidak boleh kosong" });
        }

        const result = await smartScanComplete(code);
        const duration = timeEnd(start);
        
        libLog.info("Kiosk scan-complete finished", { 
            requestId, 
            action: "kiosk_scan_complete_result",
            resultType: result.type,
            duration 
        });
        
        return NextResponse.json(result);
    } catch (error) {
        const duration = timeEnd(start);
        
        libLog.error("Kiosk scan-complete error", { 
            requestId, 
            action: "kiosk_scan_complete_error",
            duration 
        }, error as Error);
        
        return createErrorResponse(error);
    }
}
