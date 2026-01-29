"use client";

import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { 
    Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getReportTransactions } from "@/actions/finance";
import { Loader2, Printer, Search } from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";

// Helper for currency
const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
};

interface FinanceReportsProps {
    accounts: any[];
}

export default function FinanceReports({ accounts }: FinanceReportsProps) {
    const [selectedAccount, setSelectedAccount] = useState<string>("");
    const [startDate, setStartDate] = useState<string>(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    ); // First day of current month
    const [endDate, setEndDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    ); // Today
    
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        setIsLoading(true);
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            // Adjust end date to end of day
            end.setHours(23, 59, 59, 999);

            const res = await getReportTransactions({
                accountId: selectedAccount === "all" ? undefined : selectedAccount,
                startDate: start,
                endDate: end
            });

            if (res.success) {
                setTransactions(res.data || []);
                setHasSearched(true);
            } else {
                showError(res.error || "Gagal mengambil data");
            }
        } catch (error) {
            console.error(error);
             showError("Terjadi kesalahan sistem");
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate Running Balance for BKU
    let runningBalance = 0;

    return (
        <div className="space-y-6">
            {/* Filter Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Filter Laporan (BKU)</CardTitle>
                    <CardDescription>Pilih periode dan akun untuk menampilkan laporan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Akun / Sumber Dana</label>
                            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Akun" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">-- Semua Akun --</SelectItem>
                                    {accounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Dari Tanggal</label>
                            <Input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Sampai Tanggal</label>
                            <Input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                            />
                        </div>
                        <div className="flex gap-2">
                             <Button onClick={handleSearch} disabled={isLoading || !selectedAccount} className="flex-1">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                                Tampilkan
                            </Button>
                            <Button variant="outline" onClick={() => window.print()} disabled={!hasSearched}>
                                <Printer className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* BKU Table */}
            {hasSearched && (
                <Card className="print:shadow-none print:border-none">
                    <CardHeader className="print:hidden">
                        <CardTitle>Buku Kas Umum</CardTitle>
                        <CardDescription>
                            Periode: {format(new Date(startDate), "dd MMMM yyyy", { locale: idLocale })} s/d {format(new Date(endDate), "dd MMMM yyyy", { locale: idLocale })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6 print:p-0">
                        {/* Print Header */}
                        <div className="hidden print:block mb-8 text-center">
                            <h2 className="text-xl font-bold uppercase">Buku Kas Umum (BKU)</h2>
                            <h3 className="text-lg font-semibold">{accounts.find(a => a.id === selectedAccount)?.name || "Semua Akun"}</h3>
                            <p className="text-sm text-muted-foreground">
                                Periode: {format(new Date(startDate), "dd MMMM yyyy", { locale: idLocale })} - {format(new Date(endDate), "dd MMMM yyyy", { locale: idLocale })}
                            </p>
                        </div>

                        <div className="rounded-md border print:border-black">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 print:bg-gray-100">
                                        <TableHead className="w-[50px] text-center border-r print:border-black font-bold text-black">No</TableHead>
                                        <TableHead className="w-[120px] text-center border-r print:border-black font-bold text-black">Tanggal</TableHead>
                                        <TableHead className="w-[100px] text-center border-r print:border-black font-bold text-black">Kode</TableHead>
                                        <TableHead className="border-r print:border-black font-bold text-black">Uraian</TableHead>
                                        <TableHead className="text-right border-r print:border-black font-bold text-black">Debet (Masuk)</TableHead>
                                        <TableHead className="text-right border-r print:border-black font-bold text-black">Kredit (Keluar)</TableHead>
                                        <TableHead className="text-right font-bold text-black">Saldo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                Tidak ada data transaksi pada periode ini.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        transactions.map((tx, index) => {
                                            // Calculate logic
                                            let debit = 0;
                                            let credit = 0;

                                            // Determine Debit/Credit based on Type and Selected Account logic
                                            // If "All Accounts" is selected, it's tricky because Transfer is internal.
                                            // Standard BKU is usually per Account.
                                            // If Filter is Specific Account:
                                            const isSource = tx.accountIdSource === selectedAccount;
                                            const isDest = tx.accountIdDest === selectedAccount;

                                            if (selectedAccount === "all") {
                                                // Global View
                                                if (tx.type === "INCOME") {
                                                    debit = tx.amount;
                                                    runningBalance += debit;
                                                } else if (tx.type === "EXPENSE") {
                                                    credit = tx.amount;
                                                    runningBalance -= credit;
                                                }
                                                // Transfer is neutral in global view (0 change)
                                            } else {
                                                // Per Account View
                                                if (tx.type === "INCOME" && isSource) { // Income stored here
                                                    debit = tx.amount;
                                                    runningBalance += debit;
                                                } else if (tx.type === "EXPENSE" && isSource) { // Expense from here
                                                    credit = tx.amount;
                                                    runningBalance -= credit;
                                                } else if (tx.type === "TRANSFER") {
                                                    if (isSource) { // Transfer OUT
                                                        credit = tx.amount;
                                                        runningBalance -= credit;
                                                    } else if (isDest) { // Transfer IN
                                                        debit = tx.amount;
                                                        runningBalance += debit;
                                                    }
                                                }
                                            }

                                            return (
                                                <TableRow key={tx.id} className="print:border-b print:border-black/50">
                                                    <TableCell className="text-center border-r print:border-black print:py-1">{index + 1}</TableCell>
                                                    <TableCell className="text-center border-r print:border-black print:py-1">
                                                        {format(new Date(tx.date), "dd/MM/yyyy")}
                                                    </TableCell>
                                                    <TableCell className="text-center border-r print:border-black print:py-1 text-xs">
                                                        {tx.category?.name || "UMUM"}
                                                    </TableCell>
                                                    <TableCell className="border-r print:border-black print:py-1">
                                                        <div className="font-medium text-sm">{tx.description}</div>
                                                        {tx.type === "TRANSFER" && (
                                                            <div className="text-[10px] text-muted-foreground print:text-black">
                                                                {isSource ? `Ke: ${tx.accountDest?.name}` : `Dari: ${tx.accountSource?.name}`}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right border-r print:border-black print:py-1">
                                                        {debit > 0 ? formatRupiah(debit) : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right border-r print:border-black print:py-1">
                                                        {credit > 0 ? formatRupiah(credit) : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium print:text-black print:py-1">
                                                        {formatRupiah(runningBalance)}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                    {transactions.length > 0 && (
                                         <TableRow className="bg-muted/50 font-bold print:bg-gray-200">
                                            <TableCell colSpan={6} className="text-right border-r print:border-black text-black">Saldo Akhir</TableCell>
                                            <TableCell className="text-right text-black">{formatRupiah(runningBalance)}</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
