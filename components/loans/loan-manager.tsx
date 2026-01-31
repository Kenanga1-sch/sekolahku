"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Plus, Check, X, FileText, Loader2, RefreshCcw } from "lucide-react";
import { getLoans } from "@/actions/loans";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import LoanRequestDialog from "./loan-request-dialog";
import LoanApprovalDialog from "./loan-approval-dialog";
import LoanRejectionDialog from "./loan-rejection-dialog";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Helper for currency
const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function LoanManager() {
    const [loans, setLoans] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRequestOpen, setIsRequestOpen] = useState(false); 
    
    // Action Dialogs
    const [loanToApprove, setLoanToApprove] = useState<any>(null);
    const [loanToReject, setLoanToReject] = useState<any>(null);
    const [selectedLoan, setSelectedLoan] = useState<any>(null); // Detail view

    const fetchLoans = async () => {
        setIsLoading(true);
        try {
            const res = await getLoans("RECEIVABLE");
            if (res.success && res.data) {
                 setLoans(res.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLoans();
    }, []);

    const statusColor = (status: string) => {
        switch (status) {
            case "APPROVED": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
            case "REJECTED": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
            case "LUNAS": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
            case "MACET": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
            default: return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
        }
    };

    return (
        <Card className="border-none shadow-none">
            <CardHeader className="px-0 pt-0">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl">Daftar Pinjaman & Kasbon</CardTitle>
                        <CardDescription>Kelola pengajuan pinjaman pegawai di sini.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={fetchLoans}>
                            <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        <Button size="sm" onClick={() => setIsRequestOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Buat Pengajuan
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-0">
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : loans.length === 0 ? (
                    <div className="text-center p-12 border rounded-lg bg-muted/50 border-dashed">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                        <h3 className="font-medium text-lg">Belum ada data pinjaman</h3>
                        <p className="text-muted-foreground text-sm mt-1">
                            Mulai dengan membuat pengajuan pinjaman baru.
                        </p>
                    </div>
                ) : (
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Pegawai</TableHead>
                                    <TableHead>Tipe</TableHead>
                                    <TableHead>Nominal</TableHead>
                                    <TableHead>Tenor</TableHead>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loans.map((loan) => (
                                    <TableRow key={loan.id} className="hover:bg-muted/50">
                                        <TableCell>
                                            <div className="font-medium">{loan.employee?.user?.name || "Unknown"}</div>
                                            <div className="text-xs text-muted-foreground">{loan.employee?.nip || "Pegawai"}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{loan.type}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{formatRupiah(loan.amountRequested)}</div>
                                            {loan.amountApproved && loan.amountApproved !== loan.amountRequested && (
                                                <div className="text-xs text-muted-foreground line-through">
                                                    {formatRupiah(loan.amountApproved)}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>{loan.tenorMonths} Bulan</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {loan.createdAt ? format(new Date(loan.createdAt), "dd MMM yyyy", { locale: idLocale }) : "-"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={statusColor(loan.status)} variant="secondary">
                                                {loan.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {loan.status === "PENDING" ? (
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setLoanToReject(loan)}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => setLoanToApprove(loan)}>
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => setSelectedLoan(loan)}>
                                                            <FileText className="mr-2 h-4 w-4" /> Detail Pinjaman
                                                        </DropdownMenuItem>
                                                        {loan.status === "APPROVED" && (
                                                            <DropdownMenuItem disabled>
                                                                <FileText className="mr-2 h-4 w-4" /> Lihat Jadwal Cicilan
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
            
            <LoanRequestDialog open={isRequestOpen} onOpenChange={setIsRequestOpen} onSuccess={fetchLoans} />
            
            {loanToApprove && (
                <LoanApprovalDialog 
                    loan={loanToApprove} 
                    open={!!loanToApprove} 
                    onOpenChange={(op) => !op && setLoanToApprove(null)} 
                    onSuccess={fetchLoans} 
                />
            )}

            {loanToReject && (
                <LoanRejectionDialog 
                    loan={loanToReject} 
                    open={!!loanToReject} 
                    onOpenChange={(op) => !op && setLoanToReject(null)} 
                    onSuccess={fetchLoans} 
                />
            )}
        </Card>
    );
}
