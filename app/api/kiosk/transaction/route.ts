import { borrowBook, returnBook } from "@/lib/library";
import { NextResponse } from "next/server";
import { ValidationError, NotFoundError, createErrorResponse } from "@/lib/errors";
import { libLog, generateRequestId, timeStart, timeEnd } from "@/lib/logger";

export async function POST(req: Request) {
    const requestId = generateRequestId();
    const start = timeStart();
    
    try {
        const { type, memberId, itemId, loanId, loanDays } = await req.json();

        libLog.info("Transaction request", { 
            requestId, 
            action: "kiosk_transaction",
            type 
        });

        if (type === "borrow") {
            if (!memberId) {
                throw new ValidationError("ID anggota wajib diisi", { memberId: "ID anggota tidak boleh kosong" });
            }
            if (!itemId) {
                throw new ValidationError("ID buku wajib diisi", { itemId: "ID buku tidak boleh kosong" });
            }
            
            libLog.info("Processing borrow", { 
                requestId, 
                action: "borrow_start",
                memberId,
                itemId 
            });
            
            const loan = await borrowBook(memberId, itemId, loanDays || 7);
            const duration = timeEnd(start);
            
            libLog.info("Borrow completed", { 
                requestId, 
                action: "borrow_success",
                loanId: loan.id,
                duration 
            });
            
            return NextResponse.json({ success: true, loan });
        } else if (type === "return") {
            if (!loanId) {
                throw new ValidationError("ID peminjaman wajib diisi", { loanId: "ID peminjaman tidak boleh kosong" });
            }
            
            libLog.info("Processing return", { 
                requestId, 
                action: "return_start",
                loanId 
            });
            
            try {
                const loan = await returnBook(loanId);
                const duration = timeEnd(start);
                
                libLog.info("Return completed", { 
                    requestId, 
                    action: "return_success",
                    loanId,
                    fineAmount: loan.fineAmount,
                    duration 
                });
                
                return NextResponse.json({ success: true, loan });
            } catch (error) {
                if ((error as Error).message === "Loan not found") {
                    throw new NotFoundError("Peminjaman");
                }
                throw error;
            }
        }

        throw new ValidationError("Tipe transaksi tidak valid", { type: "Harus 'borrow' atau 'return'" });
    } catch (error) {
        const duration = timeEnd(start);
        
        libLog.error("Transaction error", { 
            requestId, 
            action: "transaction_error",
            duration 
        }, error as Error);
        
        return createErrorResponse(error);
    }
}
