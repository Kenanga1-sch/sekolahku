
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    FileText,
    Loader2,
    BookOpen,
    BookMarked,
    Wallet,
    History,
    PlusCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ParentLinkCard } from "@/components/parent-link-card";
import { ProfileTab } from "./_components/profile-tab";
import { DocumentsTab } from "./_components/documents-tab";
import { showSuccess, showError } from "@/lib/toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { compressImage } from "@/lib/utils";

export default function StudentDetailPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const studentId = searchParams.get('id') as string;

    const [student, setStudent] = useState<any>(null);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Active Tab State
    const [activeTab, setActiveTab] = useState("profile");

    // Savings State
    const [savingsAccount, setSavingsAccount] = useState<any>(null);
    const [savingsTransactions, setSavingsTransactions] = useState<any[]>([]);
    const [isSavingsLoading, setIsSavingsLoading] = useState(false);

    // Library State
    const [libraryMember, setLibraryMember] = useState<any>(null);
    const [libraryHistory, setLibraryHistory] = useState<any[]>([]);
    const [isLibraryLoading, setIsLibraryLoading] = useState(false);

    // Action State
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Upload State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [docType, setDocType] = useState("lainnya");
    const [docTitle, setDocTitle] = useState("");

    useEffect(() => {
        fetchData();
    }, [studentId]);

    // Fetch savings and library data when activeTab changes
    useEffect(() => {
        if (student) {
            if (activeTab === "savings") {
                fetchSavingsData();
            } else if (activeTab === "library") {
                fetchLibraryData();
            }
        }
    }, [student, activeTab]);

    const fetchSavingsData = async () => {
        if (!student) return;
        setIsSavingsLoading(true);
        try {
            const res = await fetch(`/api/savings/students/${student.nisn || student.id}`);
            if (res.ok) {
                const result = await res.json();
                if (result.success && result.data) {
                    setSavingsAccount(result.data);
                    
                    // Fetch recent transactions
                    const resTx = await fetch(`/api/savings/transactions?siswaId=${result.data.id}&limit=50`);
                    if (resTx.ok) {
                        const txResult = await resTx.json();
                        setSavingsTransactions(txResult.data || txResult.items || []);
                    }
                } else if (student.status === "active" || student.status === "aktif") {
                    // Try to auto-sync once silently
                    const resSync = await fetch("/api/savings/students/sync", { method: "POST" });
                    if (resSync.ok) {
                        const retryRes = await fetch(`/api/savings/students/${student.nisn || student.id}`);
                        if (retryRes.ok) {
                            const retryResult = await retryRes.json();
                            if (retryResult.success && retryResult.data) {
                                setSavingsAccount(retryResult.data);
                                const resTx = await fetch(`/api/savings/transactions?siswaId=${retryResult.data.id}&limit=50`);
                                if (resTx.ok) {
                                    const txResult = await resTx.json();
                                    setSavingsTransactions(txResult.data || txResult.items || []);
                                }
                                return;
                            }
                        }
                    }
                    setSavingsAccount(null);
                } else {
                    setSavingsAccount(null);
                }
            } else if (student.status === "active" || student.status === "aktif") {
                // If not 200 OK, try to auto-sync once silently
                const resSync = await fetch("/api/savings/students/sync", { method: "POST" });
                if (resSync.ok) {
                    const retryRes = await fetch(`/api/savings/students/${student.nisn || student.id}`);
                    if (retryRes.ok) {
                        const retryResult = await retryRes.json();
                        if (retryResult.success && retryResult.data) {
                            setSavingsAccount(retryResult.data);
                            const resTx = await fetch(`/api/savings/transactions?siswaId=${retryResult.data.id}&limit=50`);
                            if (resTx.ok) {
                                const txResult = await resTx.json();
                                setSavingsTransactions(txResult.data || txResult.items || []);
                            }
                            return;
                        }
                    }
                }
                setSavingsAccount(null);
            } else {
                setSavingsAccount(null);
            }
        } catch (e) {
            console.error("Error loading savings", e);
        } finally {
            setIsSavingsLoading(false);
        }
    };

    const fetchLibraryData = async () => {
        if (!student) return;
        setIsLibraryLoading(true);
        try {
            const res = await fetch(`/api/library/members?search=${student.id}`);
            if (res.ok) {
                const result = await res.json();
                const members = result.data || result.items || [];
                const member = members.find((m: any) => m.studentId === student.id);
                if (member) {
                    setLibraryMember(member);
                    
                    // Fetch loan history
                    const resHistory = await fetch(`/api/library/members/${member.id}/history?limit=50`);
                    if (resHistory.ok) {
                        const historyResult = await resHistory.json();
                        setLibraryHistory(historyResult.items || []);
                    }
                } else if (student.status === "active" || student.status === "aktif") {
                    // Try to auto-sync once silently
                    const resSync = await fetch("/api/library/members/sync", { method: "POST" });
                    if (resSync.ok) {
                        const retryRes = await fetch(`/api/library/members?search=${student.id}`);
                        if (retryRes.ok) {
                            const retryResult = await retryRes.json();
                            const retryMembers = retryResult.data || retryResult.items || [];
                            const retryMember = retryMembers.find((m: any) => m.studentId === student.id);
                            if (retryMember) {
                                setLibraryMember(retryMember);
                                const resHistory = await fetch(`/api/library/members/${retryMember.id}/history?limit=50`);
                                if (resHistory.ok) {
                                    const historyResult = await resHistory.json();
                                    setLibraryHistory(historyResult.items || []);
                                }
                                return;
                            }
                        }
                    }
                    setLibraryMember(null);
                } else {
                    setLibraryMember(null);
                }
            }
        } catch (e) {
            console.error("Error loading library details", e);
        } finally {
            setIsLibraryLoading(false);
        }
    };

    const handleSyncSavings = async () => {
        setIsActionLoading(true);
        try {
            const res = await fetch("/api/savings/students/sync", { method: "POST" });
            if (res.ok) {
                showSuccess("Rekening Tabungan berhasil dibuat");
                await fetchSavingsData();
            } else {
                throw new Error("Gagal sinkronisasi");
            }
        } catch (e: any) {
            showError(e.message || "Gagal mengaktifkan tabungan");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleSyncLibrary = async () => {
        setIsActionLoading(true);
        try {
            const res = await fetch("/api/library/members/sync", { method: "POST" });
            if (res.ok) {
                showSuccess("Anggota Perpustakaan berhasil didaftarkan");
                await fetchLibraryData();
            } else {
                throw new Error("Gagal sinkronisasi");
            }
        } catch (e: any) {
            showError(e.message || "Gagal mengaktifkan keanggotaan perpustakaan");
        } finally {
            setIsActionLoading(false);
        }
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const resStudent = await fetch(`/api/master/students/${studentId}`);
            if (!resStudent.ok) throw new Error("Siswa tidak ditemukan");
            const dataStudent = await resStudent.json();
            setStudent(dataStudent);

            await fetchDocuments();
        } catch (error) {
            console.error(error);
            showError("Gagal memuat data");
            router.push("/admin/siswa");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDocuments = async () => {
        try {
            const resDocs = await fetch(`/api/master/students/${studentId}/documents`);
            if (resDocs.ok) {
                const dataDocs = await resDocs.json();
                setDocuments(dataDocs);
            }
        } catch(e) { console.error(e); }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile) return showError("Pilih file dulu");

        setIsUploading(true);
        let finalFile = uploadFile;
        if (uploadFile.type.startsWith("image/")) {
            try {
                finalFile = await compressImage(uploadFile, 1200, 0.85);
            } catch (err) {
                console.error("Compression error:", err);
            }
        }

        const formData = new FormData();
        formData.append("file", finalFile);
        formData.append("title", docTitle || uploadFile.name);
        formData.append("type", docType);

        try {
            const res = await fetch(`/api/master/students/${studentId}/documents`, {
                method: "POST",
                body: formData
            });

            if (!res.ok) throw new Error("Gagal upload");
            
            showSuccess("Dokumen berhasil diupload");
            setUploadFile(null);
            setDocTitle("");
            await fetchDocuments();
        } catch (error) {
            showError("Gagal upload dokumen");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteDoc = async (docId: string) => {
        if(!confirm("Hapus dokumen ini?")) return;
        try {
            const res = await fetch(`/api/master/students/${studentId}/documents?docId=${docId}`, {
                method: "DELETE"
            });
            if(res.ok) {
                showSuccess("Dokumen dihapus");
                fetchDocuments();
            } else {
                showError("Gagal hapus");
            }
        } catch (e) { showError("Error"); }
    };

    if (isLoading) return <div className="flex min-h-dvh items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
    if (!student) return <div>Siswa tidak ditemukan</div>;

    const meta = (() => {
        try {
            return student.metaData ? JSON.parse(student.metaData) : {};
        } catch (e) {
            console.error("Failed to parse student metadata", e);
            return {};
        }
    })();

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold truncate">{student.fullName}</h1>
                        <div className="flex flex-wrap gap-2 text-muted-foreground text-sm">
                            <span>{student.nisn || "No NISN"}</span>
                            <span>•</span>
                            <span>{student.className || "Tanpa Kelas"}</span>
                            <span>•</span>
                            <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>{student.status}</Badge>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:pl-0">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => window.open(`/admin/siswa/buku-induk/print?id=${studentId}`, '_blank')}>
                        <FileText className="h-4 w-4 mr-2" />
                        Cetak Buku Induk
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        onClick={() => {
                            const bi = student?.bukuIndukId;
                            if (!bi) {
                                showError("Data Buku Induk belum terbentuk untuk siswa ini. Buka tab Buku Induk lalu jalankan Sinkronisasi terlebih dahulu.");
                                return;
                            }
                            window.open(`/admin/siswa/alumni-detail/edit?id=${bi}`, "_blank");
                        }}
                    >
                        <BookMarked className="h-4 w-4 mr-2" />
                        Isi Buku Induk
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full h-auto justify-start gap-1 overflow-x-auto scrollbar-none whitespace-nowrap sm:grid sm:grid-cols-5 sm:max-w-2xl">
                    <TabsTrigger value="profile" className="shrink-0">Profil</TabsTrigger>
                    <TabsTrigger value="savings" className="shrink-0">Tabungan</TabsTrigger>
                    <TabsTrigger value="library" className="shrink-0">Perpustakaan</TabsTrigger>
                    <TabsTrigger value="documents" className="shrink-0">Dokumen</TabsTrigger>
                    <TabsTrigger value="parents" className="shrink-0">Orang Tua</TabsTrigger>
                </TabsList>

                <TabsContent value="parents" className="pt-4 space-y-6">
                    <ParentLinkCard studentId={studentId} />
                </TabsContent>

                <TabsContent value="profile" className="pt-4 space-y-6">
                    <ProfileTab student={student} meta={meta} />
                </TabsContent>

                <TabsContent value="documents" className="pt-4 space-y-6">
                    <DocumentsTab
                        documents={documents}
                        docTitle={docTitle}
                        setDocTitle={setDocTitle}
                        docType={docType}
                        setDocType={setDocType}
                        setUploadFile={setUploadFile}
                        isUploading={isUploading}
                        onUpload={handleUpload}
                        onDelete={handleDeleteDoc}
                    />
                </TabsContent>

                {/* TAB: SAVINGS (TABUNGAN HARIAN) */}
                <TabsContent value="savings" className="pt-4 space-y-6">
                    {isSavingsLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin h-8 w-8 text-primary" />
                        </div>
                    ) : savingsAccount ? (
                        <>
                            {/* Saldo Card */}
                            <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-transparent">
                                <CardHeader className="pb-2">
                                    <CardDescription>Saldo Rekening Tabungan</CardDescription>
                                    <CardTitle className="text-3xl font-extrabold text-primary">
                                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(savingsAccount.saldoTerakhir || 0)}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-xs text-muted-foreground">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                                        <div>
                                            <span className="block font-medium">Nomor Rekening (QR)</span>
                                            <span className="font-semibold text-foreground">{savingsAccount.qrCode || "-"}</span>
                                        </div>
                                        <div>
                                            <span className="block font-medium">Kelas Tabungan</span>
                                            <span className="font-semibold text-foreground">{savingsAccount.kelas?.nama || "-"}</span>
                                        </div>
                                        <div>
                                            <span className="block font-medium">Status Akun</span>
                                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 mt-0.5">
                                                {savingsAccount.isActive ? "Aktif" : "Non-aktif"}
                                            </Badge>
                                        </div>
                                        <div>
                                            <span className="block font-medium">Terakhir Diperbarui</span>
                                            <span className="font-semibold text-foreground">
                                                {savingsAccount.updatedAt ? format(new Date(savingsAccount.updatedAt), "d MMM yyyy", { locale: id }) : "-"}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Transaksi History */}
                            <Card>
                                <CardHeader className="flex flex-row items-center gap-2">
                                    <History className="h-5 w-5 text-primary" />
                                    <div>
                                        <CardTitle>Riwayat Transaksi</CardTitle>
                                        <CardDescription>Daftar setoran dan penarikan tabungan harian siswa.</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {savingsTransactions.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                                            Belum ada riwayat transaksi tabungan.
                                        </div>
                                    ) : (
                                        <div className="relative w-full overflow-auto rounded-lg border">
                                            <table className="w-full caption-bottom text-sm">
                                                <thead className="bg-muted/50 [&_tr]:border-b">
                                                    <tr className="border-b transition-colors hover:bg-muted/50">
                                                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Tanggal</th>
                                                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Tipe</th>
                                                        <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">Nominal</th>
                                                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Petugas (Guru)</th>
                                                        <th className="h-10 px-4 text-center align-middle font-medium text-muted-foreground">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="[&_tr:last-child]:border-0">
                                                    {savingsTransactions.map((tx: any) => (
                                                        <tr key={tx.id} className="border-b transition-colors hover:bg-muted/50">
                                                            <td className="p-4 align-middle">{format(new Date(tx.createdAt), "d MMM yyyy HH:mm", { locale: id })}</td>
                                                            <td className="p-4 align-middle">
                                                                <Badge variant={tx.tipe === "setoran" ? "default" : "destructive"} className="text-xs">
                                                                    {tx.tipe === "setoran" ? "Setoran" : "Penarikan"}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-4 align-middle text-right font-semibold">
                                                                {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(tx.nominal || 0)}
                                                            </td>
                                                            <td className="p-4 align-middle">{tx.guruNama || tx.petugasNama || "-"}</td>
                                                            <td className="p-4 align-middle text-center">
                                                                <Badge 
                                                                    variant="outline" 
                                                                    className={
                                                                        tx.status === "verified" ? "text-emerald-600 border-emerald-200 bg-emerald-50" : 
                                                                        tx.status === "collected" ? "text-amber-600 border-amber-200 bg-amber-50" : 
                                                                        "text-red-600 border-red-200 bg-red-50"
                                                                    }
                                                                >
                                                                    {tx.status === "verified" ? "Terverifikasi" : tx.status === "collected" ? "Pending" : tx.status}
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        /* Not Active Savings Account Card */
                        <Card className="border-dashed py-8">
                            <CardContent className="flex flex-col items-center text-center space-y-4">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Wallet className="h-6 w-6 text-primary" />
                                </div>
                                <div className="space-y-2 max-w-sm">
                                    <h3 className="font-bold text-lg">Rekening Tabungan Belum Aktif</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {student.status === "active" || student.status === "aktif"
                                            ? "Siswa ini belum memiliki rekening tabungan harian aktif di Sekolahku. Silakan aktifkan rekening."
                                            : "Tabungan hanya tersedia untuk siswa aktif. Status siswa saat ini: " + student.status}
                                    </p>
                                </div>
                                {(student.status === "active" || student.status === "aktif") && (
                                    <Button onClick={handleSyncSavings} disabled={isActionLoading}>
                                        {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        <PlusCircle className="mr-2 h-4 w-4" /> Aktifkan Rekening Tabungan
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* TAB: LIBRARY (PERPUSTAKAAN) */}
                <TabsContent value="library" className="pt-4 space-y-6">
                    {isLibraryLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin h-8 w-8 text-primary" />
                        </div>
                    ) : libraryMember ? (
                        <>
                            {/* Member Card */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Kartu Anggota Perpustakaan</CardDescription>
                                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                                        <BookOpen className="h-5 w-5 text-primary" />
                                        {libraryMember.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-xs text-muted-foreground">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                                        <div>
                                            <span className="block font-medium">ID Anggota / Barcode</span>
                                            <span className="font-semibold text-foreground">{libraryMember.qrCode || "-"}</span>
                                        </div>
                                        <div>
                                            <span className="block font-medium">Maks. Batas Pinjam</span>
                                            <span className="font-semibold text-foreground">{libraryMember.maxBorrowLimit || 3} buku</span>
                                        </div>
                                        <div>
                                            <span className="block font-medium">Status Keanggotaan</span>
                                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 mt-0.5">
                                                {libraryMember.isActive ? "Aktif" : "Non-aktif"}
                                            </Badge>
                                        </div>
                                        <div>
                                            <span className="block font-medium">Tanggal Terdaftar</span>
                                            <span className="font-semibold text-foreground">
                                                {libraryMember.createdAt ? format(new Date(libraryMember.createdAt), "d MMM yyyy", { locale: id }) : "-"}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Borrowing & History */}
                            <Card>
                                <CardHeader className="flex flex-row items-center gap-2">
                                    <History className="h-5 w-5 text-primary" />
                                    <div>
                                        <CardTitle>Riwayat Peminjaman Buku</CardTitle>
                                        <CardDescription>Daftar buku yang sedang dipinjam dan riwayat peminjaman sebelumnya.</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {libraryHistory.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                                            Belum ada riwayat peminjaman buku.
                                        </div>
                                    ) : (
                                        <div className="relative w-full overflow-auto rounded-lg border">
                                            <table className="w-full caption-bottom text-sm">
                                                <thead className="bg-muted/50 [&_tr]:border-b">
                                                    <tr className="border-b transition-colors hover:bg-muted/50">
                                                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Judul Buku</th>
                                                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Tgl Pinjam</th>
                                                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Tenggat Kembali</th>
                                                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Tgl Kembali</th>
                                                        <th className="h-10 px-4 text-center align-middle font-medium text-muted-foreground">Status</th>
                                                        <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">Denda</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="[&_tr:last-child]:border-0">
                                                    {libraryHistory.map((loan: any) => (
                                                        <tr key={loan.id} className="border-b transition-colors hover:bg-muted/50">
                                                            <td className="p-4 align-middle font-medium">{loan.title}</td>
                                                            <td className="p-4 align-middle">{loan.borrowDate ? format(new Date(loan.borrowDate), "d MMM yyyy", { locale: id }) : "-"}</td>
                                                            <td className="p-4 align-middle">{loan.dueDate ? format(new Date(loan.dueDate), "d MMM yyyy", { locale: id }) : "-"}</td>
                                                            <td className="p-4 align-middle">{loan.returnDate ? format(new Date(loan.returnDate), "d MMM yyyy", { locale: id }) : "-"}</td>
                                                            <td className="p-4 align-middle text-center">
                                                                <Badge 
                                                                    variant={loan.isReturned ? "secondary" : "default"}
                                                                    className={loan.isReturned ? "bg-slate-100 text-slate-700" : "bg-blue-100 text-blue-700"}
                                                                >
                                                                    {loan.isReturned ? "Dikembalikan" : "Dipinjam"}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-4 align-middle text-right font-semibold">
                                                                {loan.fineAmount > 0 ? (
                                                                    <span className={loan.finePaid ? "text-emerald-600" : "text-red-600"}>
                                                                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(loan.fineAmount)}
                                                                        {loan.finePaid ? " (Lunas)" : " (Belum Lunas)"}
                                                                    </span>
                                                                ) : "-"}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        /* Not Active Library Member Card */
                        <Card className="border-dashed py-8">
                            <CardContent className="flex flex-col items-center text-center space-y-4">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <BookOpen className="h-6 w-6 text-primary" />
                                </div>
                                <div className="space-y-2 max-w-sm">
                                    <h3 className="font-bold text-lg">Keanggotaan Perpustakaan Belum Aktif</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {student.status === "active" || student.status === "aktif"
                                            ? "Siswa ini belum terdaftar sebagai anggota Perpustakaan Sekolahku. Silakan daftarkan."
                                            : "Keanggotaan perpustakaan hanya tersedia untuk siswa aktif. Status siswa saat ini: " + student.status}
                                    </p>
                                </div>
                                {(student.status === "active" || student.status === "aktif") && (
                                    <Button onClick={handleSyncLibrary} disabled={isActionLoading}>
                                        {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        <PlusCircle className="mr-2 h-4 w-4" /> Daftarkan Anggota Perpustakaan
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}



