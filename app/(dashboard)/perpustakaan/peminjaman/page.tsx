"use client";

import { useEffect, useState, useCallback } from "react";
import {
    BookMarked,
    Search,
    RotateCcw,
    AlertTriangle,
    Clock,
    CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getActiveLoans, getOverdueLoans, returnBook } from "@/lib/library";
import type { LibraryLoan } from "@/types/library";

export default function PeminjamanPage() {
    const [activeLoans, setActiveLoans] = useState<LibraryLoan[]>([]);
    const [overdueLoans, setOverdueLoans] = useState<LibraryLoan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [returningLoan, setReturningLoan] = useState<LibraryLoan | null>(null);

    const loadLoans = useCallback(async () => {
        setLoading(true);
        try {
            const [active, overdue] = await Promise.all([
                getActiveLoans(),
                getOverdueLoans(),
            ]);
            setActiveLoans(active.items);
            setOverdueLoans(overdue);
        } catch (error) {
            console.error("Failed to load loans:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLoans();
    }, [loadLoans]);

    const handleReturn = async () => {
        if (!returningLoan) return;
        try {
            await returnBook(returningLoan.id);
            setReturningLoan(null);
            loadLoans();
        } catch (error) {
            console.error("Failed to return book:", error);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const getDaysUntilDue = (dueDate: string) => {
        const due = new Date(dueDate);
        const now = new Date();
        const diffTime = due.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const calculateFine = (loan: LibraryLoan) => {
        if (loan.is_returned) return loan.fine_amount;
        const daysOverdue = -getDaysUntilDue(loan.due_date);
        if (daysOverdue <= 0) return 0;
        return daysOverdue * 1000; // Rp 1.000 per hari
    };

    const filteredActiveLoans = activeLoans.filter((loan) => {
        if (!searchQuery) return true;
        const memberName = loan.expand?.member?.name?.toLowerCase() || "";
        const itemTitle = loan.expand?.item?.title?.toLowerCase() || "";
        const query = searchQuery.toLowerCase();
        return memberName.includes(query) || itemTitle.includes(query);
    });

    const LoanTable = ({ loans, showFine = false }: { loans: LibraryLoan[]; showFine?: boolean }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Peminjam</TableHead>
                    <TableHead>Buku</TableHead>
                    <TableHead>Tgl Pinjam</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead>Status</TableHead>
                    {showFine && <TableHead>Denda</TableHead>}
                    <TableHead className="w-[100px]"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loans.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={showFine ? 7 : 6} className="text-center py-8 text-muted-foreground">
                            Tidak ada data peminjaman
                        </TableCell>
                    </TableRow>
                ) : (
                    loans.map((loan) => {
                        const daysUntilDue = getDaysUntilDue(loan.due_date);
                        const isOverdue = daysUntilDue < 0;
                        const fine = calculateFine(loan);

                        return (
                            <TableRow key={loan.id}>
                                <TableCell>
                                    <div>
                                        <p className="font-medium">{loan.expand?.member?.name || "-"}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {loan.expand?.member?.class_name || ""}
                                        </p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <p className="font-medium">{loan.expand?.item?.title || "-"}</p>
                                </TableCell>
                                <TableCell>{formatDate(loan.borrow_date)}</TableCell>
                                <TableCell>{formatDate(loan.due_date)}</TableCell>
                                <TableCell>
                                    {isOverdue ? (
                                        <Badge variant="destructive" className="gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Terlambat {Math.abs(daysUntilDue)} hari
                                        </Badge>
                                    ) : daysUntilDue <= 2 ? (
                                        <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800">
                                            <Clock className="h-3 w-3" />
                                            {daysUntilDue} hari lagi
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="gap-1">
                                            <CheckCircle className="h-3 w-3" />
                                            {daysUntilDue} hari
                                        </Badge>
                                    )}
                                </TableCell>
                                {showFine && (
                                    <TableCell>
                                        {fine > 0 ? (
                                            <span className="text-red-600 font-medium">
                                                Rp {fine.toLocaleString("id-ID")}
                                            </span>
                                        ) : (
                                            "-"
                                        )}
                                    </TableCell>
                                )}
                                <TableCell>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1"
                                        onClick={() => setReturningLoan(loan)}
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        Kembalikan
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })
                )}
            </TableBody>
        </Table>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Peminjaman</h1>
                <p className="text-muted-foreground">
                    Kelola peminjaman dan pengembalian buku
                </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <BookMarked className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{activeLoans.length}</p>
                                <p className="text-xs text-muted-foreground">Sedang Dipinjam</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-500/10">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{overdueLoans.length}</p>
                                <p className="text-xs text-muted-foreground">Terlambat</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/10">
                                <CheckCircle className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {activeLoans.length - overdueLoans.length}
                                </p>
                                <p className="text-xs text-muted-foreground">Tepat Waktu</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari peminjam atau judul buku..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="active">
                <TabsList>
                    <TabsTrigger value="active" className="gap-2">
                        <BookMarked className="h-4 w-4" />
                        Aktif ({activeLoans.length})
                    </TabsTrigger>
                    <TabsTrigger value="overdue" className="gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Terlambat ({overdueLoans.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-4">
                    <Card>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Memuat...
                                </div>
                            ) : (
                                <LoanTable loans={filteredActiveLoans} />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="overdue" className="mt-4">
                    <Card>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Memuat...
                                </div>
                            ) : (
                                <LoanTable loans={overdueLoans} showFine />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Return Confirmation Dialog */}
            <AlertDialog open={!!returningLoan} onOpenChange={() => setReturningLoan(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Pengembalian</AlertDialogTitle>
                        <AlertDialogDescription>
                            {returningLoan && (
                                <>
                                    <p>Kembalikan buku:</p>
                                    <p className="font-medium mt-2">
                                        {returningLoan.expand?.item?.title}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Dipinjam oleh: {returningLoan.expand?.member?.name}
                                    </p>
                                    {calculateFine(returningLoan) > 0 && (
                                        <p className="mt-2 text-red-600">
                                            Denda: Rp {calculateFine(returningLoan).toLocaleString("id-ID")}
                                        </p>
                                    )}
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReturn}>
                            Konfirmasi Pengembalian
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
