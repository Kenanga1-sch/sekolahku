"use client";

import { useEffect, useState, useCallback } from "react";
import {
    BookMarked,
    Search,
    RotateCcw,
    AlertTriangle,
    Clock,
    CheckCircle,
    ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AsyncSelect from "react-select/async";
import { DataTable } from "@/components/data-table";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
// Removed server imports to fix build error
import { showError, showSuccess } from "@/lib/toast";
import { goGet, goPost } from "@/lib/api-client";
import type { LibraryLoan, LibraryItem, LibraryMember } from "@/types/library";

export default function PeminjamanPage() {
  const searchParams = useSearchParams();
    const [activeLoans, setActiveLoans] = useState<LibraryLoan[]>([]);
    const [overdueLoans, setOverdueLoans] = useState<LibraryLoan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [returningLoan, setReturningLoan] = useState<LibraryLoan | null>(null);

    // New Loan States
    const [isNewLoanOpen, setIsNewLoanOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<any>(null);
    const [selectedBook, setSelectedBook] = useState<any>(null);
    const [loanDays, setLoanDays] = useState(7);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // URL Params for Action
    const router = useRouter();

    const loadLoans = useCallback(async () => {
        setLoading(true);
        try {
            const [activeData, overdueData]: [any, any] = await Promise.all([
                goGet("/api/library/loans?type=active"),
                goGet("/api/library/loans?type=overdue"),
            ]);

            setActiveLoans(activeData.items || []);
            setOverdueLoans(overdueData.items || []);
        } catch (error) {
            console.error("Failed to load loans:", error);
            showError("Gagal memuat data peminjaman");
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
            await goPost(`/api/library/loans/${returningLoan.id}/return`);
            
            setReturningLoan(null);
            showSuccess("Buku berhasil dikembalikan");
            loadLoans();
        } catch (error) {
            console.error("Failed to return book:", error);
            showError("Gagal mengembalikan buku");
        }
    };

    const handleCreateLoan = async () => {
        if (!selectedMember || !selectedBook) {
            showError("Pilih anggota dan buku terlebih dahulu");
            return;
        }

        setIsSubmitting(true);
        try {
            const result: any = await goPost("/api/library/loans", {
                memberId: selectedMember.value,
                itemId: selectedBook.value,
                loanDays,
            });

            showSuccess("Peminjaman berhasil dicatat");
            setIsNewLoanOpen(false);
            
            // Clean URL params without refresh
            router.replace("/perpustakaan/peminjaman");
            
            // Reset form
            setSelectedMember(null);
            setSelectedBook(null);
            setLoanDays(7);
            
            loadLoans();
        } catch (error) {
            console.error("Create loan error:", error);
            showError(error instanceof Error ? error.message : "Gagal meminjam buku");
        } finally {
            setIsSubmitting(false);
        }
    };

    const loadMemberOptions = async (inputValue: string) => {
        if (!inputValue) return [];
        const data: any = await goGet(`/api/library/members?search=${inputValue}`);
        return (data.items || []).map((m: LibraryMember) => ({ value: m.id, label: `${m.name} (${m.className})` }));
    };

    const loadBookOptions = async (inputValue: string) => {
        if (!inputValue) return [];
        const data: any = await goGet(`/api/library/books?search=${inputValue}&perPage=10`);
        return (data.items || [])
            .filter((item: LibraryItem) => item.status === "AVAILABLE")
            .map((item: LibraryItem) => ({ 
                value: item.id, // QR Code as ID
                label: `${item.title} (${item.id})` 
            }));
    };

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const getDaysUntilDue = (dueDate: Date | string) => {
        const due = new Date(dueDate);
        const now = new Date();
        const diffTime = due.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const calculateFine = (loan: LibraryLoan) => {
        if (loan.isReturned) return loan.fineAmount;
        const daysOverdue = -getDaysUntilDue(loan.dueDate);
        if (daysOverdue <= 0) return 0;
        return daysOverdue * 1000; // Rp 1.000 per hari
    };

    const filteredActiveLoans = activeLoans.filter((loan) => {
        if (!searchQuery) return true;
        const memberName = loan.member?.name?.toLowerCase() || "";
        const itemTitle = loan.item?.catalog?.title?.toLowerCase() || "";
        const query = searchQuery.toLowerCase();
        return memberName.includes(query) || itemTitle.includes(query);
    });

    const LoanTable = ({ loans, showFine = false, loading = false }: { loans: LibraryLoan[]; showFine?: boolean; loading?: boolean }) => (
        <DataTable
            data={loans}
            getRowId={(loan) => loan.id}
            loading={loading}
            emptyTitle="Tidak ada data peminjaman"
            emptyDescription="Belum ada peminjaman pada kategori ini."
            columns={[
                {
                    key: "member.name",
                    header: "Peminjam",
                    card: "title",
                    render: (loan) => (
                        <div>
                            <p className="font-medium">{loan.member?.name || "-"}</p>
                            <p className="text-xs text-muted-foreground">
                                {loan.member?.className || ""}
                            </p>
                        </div>
                    ),
                },
                {
                    key: "item.catalog.title",
                    header: "Buku",
                    card: "field",
                    render: (loan) => (
                        <div>
                            <p className="font-medium">{loan.item?.catalog?.title || "-"}</p>
                            <Badge variant="outline" className="text-[10px] h-4 font-mono">{loan.itemId}</Badge>
                        </div>
                    ),
                },
                {
                    key: "borrowDate",
                    header: "Tgl Pinjam",
                    card: "field",
                    render: (loan) => formatDate(loan.borrowDate),
                },
                {
                    key: "dueDate",
                    header: "Jatuh Tempo",
                    card: "field",
                    render: (loan) => formatDate(loan.dueDate),
                },
                {
                    key: "status",
                    header: "Status",
                    card: "field",
                    render: (loan) => {
                        const daysUntilDue = getDaysUntilDue(loan.dueDate);
                        const isOverdue = daysUntilDue < 0;
                        return isOverdue ? (
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
                        );
                    },
                },
                ...(showFine
                    ? [
                          {
                              key: "fine",
                              header: "Denda",
                              card: "field" as const,
                              render: (loan: LibraryLoan) => {
                                  const fine = calculateFine(loan);
                                  return fine > 0 ? (
                                      <span className="text-red-600 font-medium">
                                          Rp {fine.toLocaleString("id-ID")}
                                      </span>
                                  ) : (
                                      "-"
                                  );
                              },
                          },
                      ]
                    : []),
            ]}
            actions={(loan) => (
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setReturningLoan(loan)}
                >
                    <RotateCcw className="h-3 w-3" />
                    Kembalikan
                </Button>
            )}
        />
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/perpustakaan">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Peminjaman</h1>
                        <p className="text-muted-foreground">
                            Kelola peminjaman dan pengembalian buku
                        </p>
                    </div>
                </div>
                <Button onClick={() => setIsNewLoanOpen(true)} className="gap-2">
                    <BookMarked className="h-4 w-4" />
                    Pinjam Baru
                </Button>
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
                    <LoanTable loans={filteredActiveLoans} loading={loading} />
                </TabsContent>

                <TabsContent value="overdue" className="mt-4">
                    <LoanTable loans={overdueLoans} showFine loading={loading} />
                </TabsContent>
            </Tabs>

            {/* New Loan Dialog */}
            <Dialog open={isNewLoanOpen} onOpenChange={setIsNewLoanOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Catat Peminjaman Baru</DialogTitle>
                        <DialogDescription>
                            Pilih anggota dan scan/cari buku yang akan dipinjam.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Anggota</Label>
                            <AsyncSelect
                                cacheOptions
                                loadOptions={loadMemberOptions}
                                defaultOptions
                                placeholder="Cari nama anggota..."
                                onChange={setSelectedMember}
                                value={selectedMember}
                                classNames={{
                                    control: () => "border border-input bg-background rounded-md px-1",
                                    input: () => "text-sm",
                                    option: () => "text-sm"
                                }}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Buku (Scan QR / Cari Judul)</Label>
                            <AsyncSelect
                                cacheOptions
                                loadOptions={loadBookOptions}
                                defaultOptions
                                placeholder="Scan QR atau cari judul..."
                                onChange={setSelectedBook}
                                value={selectedBook}
                                classNames={{
                                    control: () => "border border-input bg-background rounded-md px-1",
                                    input: () => "text-sm",
                                    option: () => "text-sm"
                                }}
                            />
                            {selectedBook && (
                                <p className="text-[10px] text-muted-foreground">
                                    Pastikan buku berstatus TERSEDIA.
                                </p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label>Durasi Pinjam (Hari)</Label>
                            <Input 
                                type="number" 
                                min={1} 
                                value={loanDays}
                                onChange={(e) => setLoanDays(parseInt(e.target.value) || 7)} 
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewLoanOpen(false)}>Batal</Button>
                        <Button onClick={handleCreateLoan} disabled={isSubmitting}>
                            {isSubmitting && <Clock className="mr-2 h-4 w-4 animate-spin" />}
                            Simpan Peminjaman
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                                        {returningLoan.item?.catalog?.title}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Dipinjam oleh: {returningLoan.member?.name}
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

