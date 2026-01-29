import { smartScan, findLoanByItemId } from "@/lib/library";
import { NextResponse } from "next/server";
import { ValidationError, createErrorResponse } from "@/lib/errors";
import { libLog, generateRequestId, timeStart, timeEnd } from "@/lib/logger";

export async function POST(req: Request) {
    const requestId = generateRequestId();
    const start = timeStart();
    
    try {
        const { code, type } = await req.json();

        libLog.info("Kiosk scan request", { 
            requestId, 
            action: "kiosk_scan",
            type,
            codePrefix: code?.substring(0, 4) 
        });

        if (!code) {
            throw new ValidationError("Kode QR wajib diisi", { code: "Kode QR tidak boleh kosong" });
        }

        if (type === "scan") {
            const result = await smartScan(code);
            const duration = timeEnd(start);
            
            libLog.info("Kiosk scan completed", { 
                requestId, 
                action: "kiosk_scan_result",
                resultType: result.type,
                duration 
            });
            
            return NextResponse.json(result);
        } else if (type === "find-loan") {
            const loan = await findLoanByItemId(code);
            const duration = timeEnd(start);
            
            libLog.info("Loan lookup completed", { 
                requestId, 
                action: "loan_lookup",
                found: !!loan,
                duration 
            });
            
            return NextResponse.json(loan || null);
        }

        throw new ValidationError("Tipe operasi tidak valid", { type: "Harus 'scan' atau 'find-loan'" });
    } catch (error) {
        const duration = timeEnd(start);
        
        libLog.error("Kiosk scan error", { 
            requestId, 
            action: "kiosk_scan_error",
            duration 
        }, error as Error);
        
        return createErrorResponse(error);
    }
}
