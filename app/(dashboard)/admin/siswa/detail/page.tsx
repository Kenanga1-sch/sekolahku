
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
    ArrowLeft, 
    FileText, 
    Upload, 
    Trash2, 
    Eye, 
    Loader2, 
    CheckCircle2, 
    AlertCircle,
    BookOpen,
    Wallet,
    History,
    PlusCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
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
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{student.fullName}</h1>
                        <div className="flex gap-2 text-muted-foreground text-sm">
                            <span>{student.nisn || "No NISN"}</span>
                            <span>•</span>
                            <span>{student.className || "Tanpa Kelas"}</span>
                            <span>•</span>
                            <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>{student.status}</Badge>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 pl-12 sm:pl-0">
                    <Button variant="outline" size="sm" onClick={() => window.open(`/admin/siswa/buku-induk/print?id=${studentId}`, '_blank')}>
                        <FileText className="h-4 w-4 mr-2" />
                        Cetak Buku Induk
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 max-w-2xl">
                    <TabsTrigger value="profile">Profil</TabsTrigger>
                    <TabsTrigger value="savings">Tabungan</TabsTrigger>
                    <TabsTrigger value="library">Perpustakaan</TabsTrigger>
                    <TabsTrigger value="documents">Dokumen</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="pt-4 space-y-6">
                    {/* 1. DATA PRIBADI */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Data Pribadi</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div>
                                    <Label className="text-muted-foreground text-xs">Nama Lengkap</Label>
                                    <div className="font-semibold text-sm mt-1">{student.fullName || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Jenis Kelamin</Label>
                                    <div className="font-semibold text-sm mt-1">{student.gender === "L" ? "Laki-laki" : student.gender === "P" ? "Perempuan" : "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">NISN</Label>
                                    <div className="font-semibold text-sm mt-1">{student.nisn || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">NIS (Lokal)</Label>
                                    <div className="font-semibold text-sm mt-1">{student.nis || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">NIK</Label>
                                    <div className="font-semibold text-sm mt-1">{student.nik || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Tempat, Tanggal Lahir</Label>
                                    <div className="font-semibold text-sm mt-1">
                                        {student.birthPlace || "-"}, {student.birthDate || "-"}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Agama</Label>
                                    <div className="font-semibold text-sm mt-1">{student.religion || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Nomor KIP</Label>
                                    <div className="font-semibold text-sm mt-1">{student.kip || "-"}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 2. ALAMAT & KONTAK */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Alamat & Kontak</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="col-span-2">
                                    <Label className="text-muted-foreground text-xs">Alamat Jalan</Label>
                                    <div className="font-semibold text-sm mt-1">{student.address || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">RT / RW</Label>
                                    <div className="font-semibold text-sm mt-1">
                                        {(meta.rt !== undefined && meta.rt !== null && String(meta.rt).trim() !== "") ? `RT ${meta.rt}` : "-"} / {(meta.rw !== undefined && meta.rw !== null && String(meta.rw).trim() !== "") ? `RW ${meta.rw}` : "-"}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Nama Dusun</Label>
                                    <div className="font-semibold text-sm mt-1">{meta.dusun || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Kelurahan / Desa</Label>
                                    <div className="font-semibold text-sm mt-1">{meta.kelurahan || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Kode Pos</Label>
                                    <div className="font-semibold text-sm mt-1">{meta.kodePos || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Jenis Tinggal</Label>
                                    <div className="font-semibold text-sm mt-1">{meta.jenisTinggal || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Alat Transportasi</Label>
                                    <div className="font-semibold text-sm mt-1">{meta.alatTransportasi || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">No. Telepon Seluler (HP)</Label>
                                    <div className="font-semibold text-sm mt-1">{student.parentPhone || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">No. Telepon Rumah</Label>
                                    <div className="font-semibold text-sm mt-1">{meta.teleponRumah || "-"}</div>
                                </div>
                                <div className="col-span-2">
                                    <Label className="text-muted-foreground text-xs">Email</Label>
                                    <div className="font-semibold text-sm mt-1">{meta.email || "-"}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. DATA ORANG TUA / WALI */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Data Orang Tua & Wali</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Section Ayah */}
                            <div className="border-b pb-6">
                                <h4 className="font-bold text-sm mb-4 text-primary">Detail Ayah Kandung</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Nama Ayah</Label>
                                        <div className="font-semibold text-sm mt-1">{student.fatherName || "-"}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs">NIK Ayah</Label>
                                        <div className="font-semibold text-sm mt-1">{meta.fatherNik || "-"}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Tahun Lahir Ayah</Label>
                                        <div className="font-semibold text-sm mt-1">{meta.fatherBirthYear || "-"}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Pendidikan Ayah</Label>
                                        <div className="font-semibold text-sm mt-1">{meta.fatherEducation || "-"}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Pekerjaan Ayah</Label>
                                        <div className="font-semibold text-sm mt-1">{meta.fatherJob || "-"}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Penghasilan Ayah</Label>
                                        <div className="font-semibold text-sm mt-1">{meta.fatherIncome || "-"}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Section Ibu */}
                            <div className="border-b pb-6">
                                <h4 className="font-bold text-sm mb-4 text-primary">Detail Ibu Kandung</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Nama Ibu</Label>
                                        <div className="font-semibold text-sm mt-1">{student.motherName || "-"}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs">NIK Ibu</Label>
                                        <div className="font-semibold text-sm mt-1">{meta.motherNik || "-"}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Tahun Lahir Ibu</Label>
                                        <div className="font-semibold text-sm mt-1">{meta.motherBirthYear || "-"}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Pendidikan Ibu</Label>
                                        <div className="font-semibold text-sm mt-1">{meta.motherEducation || "-"}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Pekerjaan Ibu</Label>
                                        <div className="font-semibold text-sm mt-1">{meta.motherJob || "-"}</div>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Penghasilan Ibu</Label>
                                        <div className="font-semibold text-sm mt-1">{meta.motherIncome || "-"}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Section Wali (Hanya Tampil Jika Ada) */}
                            {student.guardianName && (
                                <div>
                                    <h4 className="font-bold text-sm mb-4 text-primary">Detail Wali</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                        <div>
                                            <Label className="text-muted-foreground text-xs">Nama Wali</Label>
                                            <div className="font-semibold text-sm mt-1">{student.guardianName || "-"}</div>
                                        </div>
                                        <div>
                                            <Label className="text-muted-foreground text-xs">NIK Wali</Label>
                                            <div className="font-semibold text-sm mt-1">{meta.guardianNik || "-"}</div>
                                        </div>
                                        <div>
                                            <Label className="text-muted-foreground text-xs">Tahun Lahir Wali</Label>
                                            <div className="font-semibold text-sm mt-1">{meta.guardianBirthYear || "-"}</div>
                                        </div>
                                        <div>
                                            <Label className="text-muted-foreground text-xs">Pendidikan Wali</Label>
                                            <div className="font-semibold text-sm mt-1">{meta.guardianEducation || "-"}</div>
                                        </div>
                                        <div>
                                            <Label className="text-muted-foreground text-xs">Pekerjaan Wali</Label>
                                            <div className="font-semibold text-sm mt-1">{meta.guardianJob || "-"}</div>
                                        </div>
                                        <div>
                                            <Label className="text-muted-foreground text-xs">Penghasilan Wali</Label>
                                            <div className="font-semibold text-sm mt-1">{meta.guardianIncome || "-"}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 4. DATA PERIODIK & LONGITUDINAL */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Data Periodik & Longitudinal</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                <div>
                                    <Label className="text-muted-foreground text-xs">Tinggi Badan</Label>
                                    <div className="font-semibold text-sm mt-1">{meta.tinggiBadan ? `${meta.tinggiBadan} cm` : "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Berat Badan</Label>
                                    <div className="font-semibold text-sm mt-1">{meta.beratBadan ? `${meta.beratBadan} kg` : "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Lingkar Kepala</Label>
                                    <div className="font-semibold text-sm mt-1">{meta.lingkarKepala ? `${meta.lingkarKepala} cm` : "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Jarak Rumah ke Sekolah</Label>
                                    <div className="font-semibold text-sm mt-1">{meta.jarakSekolah || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Waktu Tempuh</Label>
                                    <div className="font-semibold text-sm mt-1">{meta.waktuTempuh || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Jumlah Saudara Kandung</Label>
                                    <div className="font-semibold text-sm mt-1">{(meta.jumlahSaudara !== undefined && meta.jumlahSaudara !== null) ? `${meta.jumlahSaudara} orang` : "-"}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="documents" className="pt-4 space-y-6">
                    {/* Upload Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Upload className="h-4 w-4" /> Upload Dokumen Baru
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 item-end">
                                <div className="flex-1 space-y-2">
                                    <Label>Judul Dokumen</Label>
                                    <Input 
                                        placeholder="Contoh: Kartu Keluarga 2024" 
                                        value={docTitle}
                                        onChange={(e) => setDocTitle(e.target.value)}
                                        required 
                                    />
                                </div>
                                <div className="w-[200px] space-y-2">
                                    <Label>Jenis</Label>
                                    <Select value={docType} onValueChange={setDocType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="kk">Kartu Keluarga (KK)</SelectItem>
                                            <SelectItem value="akta">Akta Kelahiran</SelectItem>
                                            <SelectItem value="kip">KIP / Bansos</SelectItem>
                                            <SelectItem value="ijazah_tk">Ijazah TK</SelectItem>
                                            <SelectItem value="foto">Pas Foto</SelectItem>
                                            <SelectItem value="lainnya">Lainnya</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Label>File (Max 5MB)</Label>
                                    <Input 
                                        type="file" 
                                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                        accept=".pdf,.jpg,.jpeg,.png"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <Button type="submit" disabled={isUploading}>
                                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Upload
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Documents List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {documents.length === 0 ? (
                            <div className="col-span-full text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                                <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                Belum ada dokumen diupload
                            </div>
                        ) : (
                            documents.map(doc => (
                                <Card key={doc.id} className="group hover:border-primary/50 transition-colors">
                                    <CardContent className="p-4 flex items-start gap-3">
                                        <div className="mt-1 h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                                            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium truncate" title={doc.title}>{doc.title}</h4>
                                            <p className="text-xs text-muted-foreground capitalize mb-2">{doc.type.replace('_', ' ')}</p>
                                            <div className="text-xs text-muted-foreground">
                                                {format(new Date(doc.uploadedAt), "d MMM yyyy", { locale: id })}
                                            </div>
                                        </div>
                                    </CardContent>
                                    <div className="p-3 border-t bg-muted/20 flex items-center justify-end gap-2">
                                        <Button variant="ghost" size="sm" asChild>
                                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                                <Eye className="h-3 w-3 mr-1" /> Lihat
                                            </a>
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteDoc(doc.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
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



