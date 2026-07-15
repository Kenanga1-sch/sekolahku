"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
    ArrowLeft, 
    FileText, 
    Settings, 
    BookOpen, 
    CheckCircle2, 
    RefreshCw, 
    Database, 
    History,
    Search,
    Info,
    Check,
    Plus,
    Pencil,
    Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import { Badge } from "@/components/ui/badge";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function previewLetterNumber(formatPattern: string, sequence: number, classificationCode: string, date = new Date()) {
    const padded3 = String(sequence).padStart(3, "0");
    const padded2 = String(sequence).padStart(2, "0");
    const padded4 = String(sequence).padStart(4, "0");
    const rawSeq = String(sequence);
    const year = String(date.getFullYear());
    const month = romanMonths[date.getMonth()];
    const monthNumeric = String(date.getMonth() + 1).padStart(2, "0");

    return (formatPattern || "{nomor}/{kode_klasifikasi}/SDN1-KNG/{bulan}/{tahun}")
        .replaceAll("{kode_klasifikasi}", classificationCode || "400.3.5.02")
        .replaceAll("{nomor_urut_raw}", rawSeq)
        .replaceAll("{nomor_raw}", rawSeq)
        .replaceAll("{no_raw}", rawSeq)
        .replaceAll("{nomor_urut_2}", padded2)
        .replaceAll("{nomor_urut_3}", padded3)
        .replaceAll("{nomor_urut_4}", padded4)
        .replaceAll("{nomor_urut}", padded3)
        .replaceAll("{nomor}", padded3)
        .replaceAll("{no}", padded3)
        .replaceAll("{bulan_angka}", monthNumeric)
        .replaceAll("{bulan}", month)
        .replaceAll("{bulan_romawi}", month)
        .replaceAll("{tahun}", year);
}

export default function PengaturanPersuratanPage() {
    const router = useRouter();
    const { settings: schoolSettings, refresh: refreshSettings } = useSchoolSettings();
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Inputs States
    const [letterFormat, setLetterFormat] = useState("");
    const [lastNumber, setLastNumber] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    // Classification & History list
    const [classifications, setClassifications] = useState<any[]>([]);
    const [recentLetters, setRecentLetters] = useState<any[]>([]);
    const [searchClass, setSearchClass] = useState("");

    // Preview config
    const [previewClassCode, setPreviewClassCode] = useState("400.3.5.02");
    const [previewSeq, setPreviewSeq] = useState(1);

    // Dialog states
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Create form states
    const [createCode, setCreateCode] = useState("");
    const [createName, setCreateName] = useState("");
    const [createDescription, setCreateDescription] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Edit form states
    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [editCode, setEditCode] = useState("");
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editIsActive, setEditIsActive] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    // Delete states
    const [classToDelete, setClassToDelete] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const formatInputRef = useRef<HTMLInputElement>(null);

    const fetchClassificationsAndHistory = async () => {
        setIsLoadingData(true);
        try {
            // Load classifications (both active and inactive for management)
            const classRes: any = await goGet("/api/eoffice/klasifikasi?include_inactive=true");
            if (classRes && Array.isArray(classRes.data)) {
                setClassifications(classRes.data);
            }
            
            // Load recent outgoing letters
            const lettersRes: any = await goGet("/api/eoffice/surat-keluar?limit=5");
            if (lettersRes && Array.isArray(lettersRes.data)) {
                setRecentLetters(lettersRes.data);
            }
        } catch (e) {
            console.error("Gagal memuat data klasifikasi / riwayat:", e);
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleOpenEditDialog = (item: any) => {
        setSelectedClass(item);
        setEditCode(item.code);
        setEditName(item.name);
        setEditDescription(item.description || "");
        setEditIsActive(item.isActive !== false);
        setIsEditOpen(true);
    };

    const handleOpenDeleteDialog = (item: any) => {
        setClassToDelete(item);
        setIsDeleteOpen(true);
    };

    const handleCreateClassification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createCode.trim() || !createName.trim()) {
            toast.error("Kode dan nama klasifikasi wajib diisi");
            return;
        }

        setIsCreating(true);
        try {
            const payload = {
                code: createCode.trim(),
                name: createName.trim(),
                description: createDescription.trim() || null,
                isActive: true
            };
            const res: any = await goPost("/api/eoffice/klasifikasi", payload);
            if (res && res.success) {
                toast.success("Klasifikasi baru berhasil ditambahkan");
                setCreateCode("");
                setCreateName("");
                setCreateDescription("");
                setIsCreateOpen(false);
                fetchClassificationsAndHistory();
            } else {
                toast.error(res?.error || "Gagal menambahkan klasifikasi");
            }
        } catch (error: any) {
            toast.error(error?.message || "Gagal menambahkan klasifikasi");
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdateClassification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClass) return;
        if (!editName.trim()) {
            toast.error("Nama klasifikasi wajib diisi");
            return;
        }

        setIsUpdating(true);
        try {
            const payload = {
                code: editCode.trim(),
                name: editName.trim(),
                description: editDescription.trim() || null,
                isActive: editIsActive
            };
            const res: any = await goPut(`/api/eoffice/klasifikasi/${selectedClass.code}`, payload);
            if (res && res.success) {
                toast.success("Klasifikasi berhasil diperbarui");
                setIsEditOpen(false);
                setSelectedClass(null);
                fetchClassificationsAndHistory();
            } else {
                toast.error(res?.error || "Gagal memperbarui klasifikasi");
            }
        } catch (error: any) {
            toast.error(error?.message || "Gagal memperbarui klasifikasi");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteClassification = async () => {
        if (!classToDelete) return;

        setIsDeleting(true);
        try {
            const res: any = await goDelete(`/api/eoffice/klasifikasi/${classToDelete.code}`);
            if (res && res.success) {
                toast.success("Klasifikasi berhasil dihapus/dinonaktifkan");
                setIsDeleteOpen(false);
                setClassToDelete(null);
                fetchClassificationsAndHistory();
            } else {
                toast.error(res?.error || "Gagal menghapus klasifikasi");
            }
        } catch (error: any) {
            toast.error(error?.message || "Gagal menghapus klasifikasi");
        } finally {
            setIsDeleting(false);
        }
    };

    useEffect(() => {
        if (schoolSettings) {
            setLetterFormat(schoolSettings.letter_number_format || "421/{nomor}/SDN1-KNG/{bulan}/{tahun}");
            setLastNumber(schoolSettings.last_letter_number || 0);
            setPreviewSeq((schoolSettings.last_letter_number || 0) + 1);
        }
        fetchClassificationsAndHistory();
    }, [schoolSettings]);

    const handleSaveSettings = async () => {
        if (!letterFormat.trim()) {
            toast.error("Format nomor surat tidak boleh kosong");
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...schoolSettings,
                letter_number_format: letterFormat,
                last_letter_number: lastNumber
            };
            await goPost("/api/admin/school-settings", payload);
            await refreshSettings();
            toast.success("Pengaturan persuratan berhasil disimpan");
        } catch (error) {
            toast.error("Gagal menyimpan pengaturan");
        } finally {
            setIsSaving(false);
        }
    };

    const handleInsertPlaceholder = (placeholder: string) => {
        const input = formatInputRef.current;
        if (!input) return;

        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const val = letterFormat;

        const newVal = val.substring(0, start) + placeholder + val.substring(end);
        setLetterFormat(newVal);

        // Reset cursor focus
        setTimeout(() => {
            input.focus();
            const newCursorPos = start + placeholder.length;
            input.setSelectionRange(newCursorPos, newCursorPos);
        }, 50);
    };

    const applyPreset = (preset: string) => {
        setLetterFormat(preset);
        toast.info("Preset format diterapkan!");
    };

    // Filtered classifications
    const filteredClassifications = classifications.filter((c) => {
        return c.code.toLowerCase().includes(searchClass.toLowerCase()) || 
               c.name.toLowerCase().includes(searchClass.toLowerCase());
    });

    const placeholderButtons = [
        { label: "Klasifikasi", value: "{kode_klasifikasi}", desc: "Kode Masalah Dinas (misal: 400.3.5)" },
        { label: "No (3 Digit)", value: "{nomor}", desc: "Sequence padded 3 digit (misal: 050)" },
        { label: "No (Murni)", value: "{nomor_raw}", desc: "Sequence murni tanpa padding (misal: 50)" },
        { label: "No (2 Digit)", value: "{nomor_urut_2}", desc: "Sequence padded 2 digit (misal: 50, 05)" },
        { label: "No (4 Digit)", value: "{nomor_urut_4}", desc: "Sequence padded 4 digit (misal: 0050)" },
        { label: "Bulan Romawi", value: "{bulan}", desc: "Bulan dalam angka Romawi (misal: VI)" },
        { label: "Bulan Angka", value: "{bulan_angka}", desc: "Bulan dalam angka Arab biasa (misal: 06)" },
        { label: "Tahun", value: "{tahun}", desc: "Tahun 4 digit (misal: 2026)" },
    ];

    const presets = [
        { name: "Format Baru Permendagri 83/2022", value: "{nomor}/{kode_klasifikasi}/SDN1-KNG/{bulan}/{tahun}", desc: "No Urut di Depan" },
        { name: "Format Tradisional Sekolah", value: "{kode_klasifikasi}/{nomor_raw}-SD", desc: "Klasifikasi di Depan, No Urut Murni Suffix" },
        { name: "Format Klasik Kemendikbud", value: "{kode_klasifikasi}/{nomor}/SDN1/{bulan_angka}/{tahun}", desc: "Klasifikasi di Depan, Bulan Angka" },
    ];

    const getCategoryBadgeColor = (code: string) => {
        if (code.startsWith("400.3")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
        if (code.startsWith("421")) return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
        return "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300";
    };

    const getFilingGuideline = (code: string) => {
        if (code.startsWith("400.3.5.01") || code.startsWith("400.3.5.08") || code.startsWith("400.3.5.12")) {
            return {
                folder: "Berkas Kepegawaian (PTK)",
                color: "Merah (Red Binder)",
                desc: "Simpan dokumen fisik di Laci A / Folder Gantung Kepegawaian. Urutkan berdasarkan NIP/Nama PTK secara vertikal."
            };
        }
        if (code.startsWith("400.3.5.09")) {
            return {
                folder: "Mutasi & Pindahan Siswa",
                color: "Kuning (Yellow Folder)",
                desc: "Simpan di Kabinet B2 (Kesiswaan). Urutkan berdasarkan NISN dan lampirkan Surat Keterangan Pindah Sekolah asal."
            };
        }
        if (code.startsWith("400.3.11") || code.startsWith("400.3.5.03")) {
            return {
                folder: "Kurikulum & Akademik",
                color: "Biru (Blue Binder)",
                desc: "Simpan di Folder Kurikulum Rak Utama. Kelompokkan per semester/tahun ajaran akademik aktif."
            };
        }
        return {
            folder: "Administrasi & Umum",
            color: "Hijau (Green Folder)",
            desc: "Simpan di Filing Cabinet A1. Pengelompokan kronologis tahunan berdasarkan nomor klasifikasi masalah umum."
        };
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => router.push("/arsip")} 
                    className="p-0 h-auto text-muted-foreground hover:text-slate-900 dark:hover:text-white hover:bg-transparent -ml-1 flex items-center gap-1.5 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali ke E-Arsip
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Pengaturan Persuratan</h1>
                    <p className="text-muted-foreground text-sm">
                        Kelola konfigurasi nomor surat otomatis, daftar klasifikasi, dan tata pemberkasan arsip dinas.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="format" className="space-y-6">
                <TabsList className="bg-slate-100 dark:bg-zinc-950 p-1 rounded-lg">
                    <TabsTrigger value="format" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Konfigurasi Format
                    </TabsTrigger>
                    <TabsTrigger value="klasifikasi" className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Klasifikasi Dinas ({classifications.length})
                    </TabsTrigger>
                    <TabsTrigger value="pemberkasan" className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Panduan Pemberkasan
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: FORMAT PENOMORAN */}
                <TabsContent value="format" className="space-y-6">
                    <div className="grid lg:grid-cols-3 gap-6">
                        
                        {/* Builder & Settings Form */}
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="border border-slate-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900">
                                <CardHeader>
                                    <CardTitle>Struktur Nomor Surat Otomatis</CardTitle>
                                    <CardDescription>
                                        Tentukan format pola nomor surat keluar yang akan di-generate secara otomatis oleh generator.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Format Input */}
                                    <div className="space-y-2">
                                        <Label htmlFor="letter_format" className="font-semibold text-sm">Pola Pola Penomoran</Label>
                                        <Input 
                                            id="letter_format"
                                            ref={formatInputRef}
                                            value={letterFormat}
                                            onChange={(e) => setLetterFormat(e.target.value)}
                                            placeholder="Gunakan placeholders di bawah..."
                                            className="text-base font-mono py-6 bg-slate-50 dark:bg-zinc-950 tracking-wide border border-slate-300 dark:border-zinc-800"
                                        />
                                    </div>

                                    {/* Placeholders Generator Badges */}
                                    <div className="space-y-3">
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Placeholder Variabel (Klik untuk masukkan):</Label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {placeholderButtons.map((btn) => (
                                                <Button
                                                    key={btn.value}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleInsertPlaceholder(btn.value)}
                                                    className="h-auto py-2 px-3 text-xs flex flex-col items-center justify-center gap-1 border-dashed hover:border-blue-500 hover:text-blue-600 bg-white dark:bg-zinc-900"
                                                    title={btn.desc}
                                                >
                                                    <span className="font-mono text-[11px] font-bold text-blue-500">{btn.value}</span>
                                                    <span className="text-[10px] text-muted-foreground">{btn.label}</span>
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sequence and Reset config */}
                                    <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                        <div className="space-y-2">
                                            <Label htmlFor="last_letter" className="font-semibold text-sm">Nomor Urut Terakhir</Label>
                                            <Input 
                                                id="last_letter"
                                                type="number"
                                                value={lastNumber}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setLastNumber(val);
                                                    setPreviewSeq(val + 1);
                                                }}
                                                className="bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-800"
                                            />
                                            <p className="text-[11px] text-muted-foreground">
                                                Nomor surat berikutnya otomatis menggunakan angka <strong>{(lastNumber + 1)}</strong>.
                                            </p>
                                        </div>

                                        <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-lg border flex flex-col justify-center space-y-2">
                                            <div className="flex items-start gap-2">
                                                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                                <span className="text-xs leading-relaxed text-muted-foreground">
                                                    Penomoran surat kearsipan dinas secara umum **di-reset kembali ke nomor 1 setiap tahun baru** (1 Januari).
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardContent className="flex justify-end gap-2 bg-slate-50 dark:bg-zinc-950/40 p-4 border-t border-slate-100 dark:border-zinc-800">
                                    <Button 
                                        onClick={handleSaveSettings}
                                        disabled={isSaving}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm px-6"
                                    >
                                        {isSaving ? (
                                            <>
                                                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                                Menyimpan...
                                            </>
                                        ) : "Simpan Pengaturan"}
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Presets Card */}
                            <Card className="border border-slate-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900">
                                <CardHeader>
                                    <CardTitle className="text-lg">Preset Format Cepat</CardTitle>
                                    <CardDescription>Pilih preset di bawah ini untuk menerapkan template format yang umum digunakan.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {presets.map((p) => (
                                        <div 
                                            key={p.value}
                                            className="flex flex-col md:flex-row md:items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors bg-white dark:bg-zinc-900 gap-3"
                                        >
                                            <div>
                                                <h4 className="text-sm font-semibold">{p.name}</h4>
                                                <p className="text-xs text-muted-foreground">{p.desc}</p>
                                                <code className="text-xs font-mono text-slate-600 dark:text-slate-300 mt-1 block bg-slate-50 dark:bg-zinc-950 p-1 rounded inline-block">{p.value}</code>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => applyPreset(p.value)}
                                                className="shrink-0 text-xs text-blue-600 hover:text-blue-700"
                                            >
                                                Gunakan Preset
                                            </Button>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Interactive Preview & Quick History */}
                        <div className="space-y-6">
                            
                            {/* Live Preview Card */}
                            <Card className="border border-blue-200 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-950/10 shadow-sm overflow-hidden">
                                <div className="bg-blue-600 p-4 text-white">
                                    <CardTitle className="text-white text-base">Pratinjau Nomor Tergenerasi</CardTitle>
                                    <CardDescription className="text-blue-100 text-xs">Simulasi real-time nomor surat keluar berikutnya</CardDescription>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Uji Coba Kode</Label>
                                                <Input 
                                                    value={previewClassCode}
                                                    onChange={(e) => setPreviewClassCode(e.target.value)}
                                                    className="h-8 text-xs font-mono bg-white dark:bg-zinc-900"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Uji Coba No. Urut</Label>
                                                <Input 
                                                    type="number"
                                                    value={previewSeq}
                                                    onChange={(e) => setPreviewSeq(parseInt(e.target.value) || 1)}
                                                    className="h-8 text-xs font-mono bg-white dark:bg-zinc-900"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4 p-4 rounded-lg bg-white dark:bg-zinc-950 border border-blue-100 dark:border-blue-950 flex flex-col items-center justify-center space-y-1 min-h-[90px]">
                                            <span className="text-[10px] uppercase text-blue-500 font-bold tracking-wider">Nomor Surat Anda:</span>
                                            <span className="font-mono font-bold text-sm md:text-base text-slate-800 dark:text-white break-all text-center select-all px-2 py-1 rounded bg-slate-50 dark:bg-zinc-900 border">
                                                {previewLetterNumber(letterFormat, previewSeq, previewClassCode)}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Recent Outgoing Letters log */}
                            <Card className="border border-slate-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900">
                                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                    <div>
                                        <CardTitle className="text-base">Registrasi Terakhir</CardTitle>
                                        <CardDescription className="text-xs">Nomor surat keluar dinas terbaru</CardDescription>
                                    </div>
                                    <History className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent className="space-y-3 pt-2">
                                    {isLoadingData ? (
                                        [1, 2, 3].map((i) => (
                                            <div key={i} className="h-10 bg-slate-100 dark:bg-zinc-950 rounded animate-pulse" />
                                        ))
                                    ) : recentLetters.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-4">Belum ada riwayat penerbitan surat.</p>
                                    ) : (
                                        recentLetters.map((letter) => (
                                            <div key={letter.id} className="flex justify-between items-start p-2 rounded hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors border border-slate-100 dark:border-zinc-900 gap-2">
                                                <div className="space-y-0.5">
                                                    <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[200px]" title={letter.mailNumber}>
                                                        {letter.mailNumber}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground block truncate max-w-[180px]">
                                                        Penerima: {letter.recipient}
                                                    </span>
                                                </div>
                                                <Badge className="text-[9px] py-0 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 pointer-events-none">
                                                    Urut {letter.mailNumber ? extractSequenceNumber(letter.mailNumber, letter.classificationCode || "") : "1"}
                                                </Badge>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 2: DAFTAR KLASIFIKASI SURAT */}
                <TabsContent value="klasifikasi" className="space-y-6">
                    <Card className="border border-slate-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900">
                        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
                            <div>
                                <CardTitle>Daftar Klasifikasi Tata Persuratan Dinas</CardTitle>
                                <CardDescription>Kelola Kode Klasifikasi Arsip Sekolah untuk penomoran dan tata pemberkasan surat.</CardDescription>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Cari kode atau nama..." 
                                        value={searchClass}
                                        onChange={(e) => setSearchClass(e.target.value)}
                                        className="pl-9 h-9 bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-800"
                                    />
                                </div>
                                <Button 
                                    onClick={() => setIsCreateOpen(true)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm h-9 w-full sm:w-auto gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Tambah Klasifikasi
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50 dark:bg-zinc-950">
                                        <TableHead className="w-[140px] font-bold">Kode Klasifikasi</TableHead>
                                        <TableHead className="font-bold">Kategori/Tujuan Dinas</TableHead>
                                        <TableHead className="font-bold">Fungsi / Penjelasan Kode</TableHead>
                                        <TableHead className="font-bold w-[120px] text-center">Status</TableHead>
                                        <TableHead className="font-bold w-[120px] text-center">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingData ? (
                                        [1, 2, 3].map((i) => (
                                            <TableRow key={i}>
                                                <TableCell><div className="h-4 w-20 bg-slate-100 dark:bg-zinc-950 rounded animate-pulse" /></TableCell>
                                                <TableCell><div className="h-4 w-48 bg-slate-100 dark:bg-zinc-950 rounded animate-pulse" /></TableCell>
                                                <TableCell><div className="h-4 w-64 bg-slate-100 dark:bg-zinc-950 rounded animate-pulse" /></TableCell>
                                                <TableCell><div className="h-4 w-12 mx-auto bg-slate-100 dark:bg-zinc-950 rounded animate-pulse" /></TableCell>
                                                <TableCell><div className="h-4 w-16 mx-auto bg-slate-100 dark:bg-zinc-950 rounded animate-pulse" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredClassifications.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                                Tidak ada klasifikasi surat yang ditemukan.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredClassifications.map((item) => (
                                            <TableRow key={item.code} className={`hover:bg-slate-50 dark:hover:bg-zinc-950/40 ${!item.isActive ? "opacity-60 bg-slate-50/30 dark:bg-zinc-950/10" : ""}`}>
                                                <TableCell className="font-mono font-bold text-slate-800 dark:text-white">
                                                    {item.code}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <span className="font-medium text-foreground block">{item.name}</span>
                                                        <Badge className={`text-[10px] font-medium border-0 px-2 py-0.5 ${getCategoryBadgeColor(item.code)}`}>
                                                            {item.code.startsWith("400.3") ? "Permendagri 83/2022" : "Dinas"}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                                                    {item.description || <em className="text-slate-400">Belum ada penjelasan kode klasifikasi.</em>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {item.isActive ? (
                                                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0 pointer-events-none">
                                                            <Check className="h-3 w-3 mr-1" />
                                                            Aktif
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-slate-100 text-slate-500 dark:bg-zinc-900 dark:text-slate-400 border-0 pointer-events-none">
                                                            Nonaktif
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleOpenEditDialog(item)}
                                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                                            title="Edit Klasifikasi"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleOpenDeleteDialog(item)}
                                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                            title="Hapus Klasifikasi"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 3: PANDUAN PEMBERKASAN FISIK */}
                <TabsContent value="pemberkasan" className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* ANRI / Permendagri principles */}
                        <Card className="border border-slate-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900">
                            <CardHeader>
                                <CardTitle className="text-lg">Prinsip Asosiasi Klasifikasi (ANRI/Permendagri)</CardTitle>
                                <CardDescription>Tata cara penyimpanan arsip sekolah yang tertib sesuai kode klasifikasi masalah.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                <p>
                                    Penggunaan kode klasifikasi bukan sekedar identitas penomoran di kepala surat, melainkan **kunci utama penataan arsip fisik** di dalam lemari berkas (*Filing Cabinet*).
                                </p>
                                <div className="space-y-3 pt-2">
                                    <div className="flex gap-3 items-start">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded mt-0.5 font-bold text-xs font-mono shrink-0">1</div>
                                        <p>
                                            <strong>Satu Kode = Satu Folder:</strong> Surat masuk dan surat keluar yang memiliki kode klasifikasi sama harus disatukan dalam map gantung (*Snelhechter*) yang sama. Jangan memisahkan fisik surat masuk dan keluar jika kodenya sejenis.
                                        </p>
                                    </div>
                                    <div className="flex gap-3 items-start">
                                        <div className="p-2 bg-purple-100 dark:bg-purple-900/20 text-purple-600 rounded mt-0.5 font-bold text-xs font-mono shrink-0">2</div>
                                        <p>
                                            <strong>Nomor Agenda Kronologis:</strong> Buku agenda mencatat surat secara kronologis harian, namun peletakan fisik lembaran surat di lemari arsip disusun per **Kode Klasifikasi** secara vertikal.
                                        </p>
                                    </div>
                                    <div className="flex gap-3 items-start">
                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 rounded mt-0.5 font-bold text-xs font-mono shrink-0">3</div>
                                        <p>
                                            <strong>Warna Binder Folder:</strong> Gunakan kode warna binder folder kearsipan untuk memudahkan identifikasi visual saat mencari dokumen di dalam rak lemari.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Interactive Filing Advisor */}
                        <Card className="border border-slate-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900">
                            <CardHeader>
                                <CardTitle className="text-lg">Filing Advisor Kearsipan Fisik</CardTitle>
                                <CardDescription>Pilih klasifikasi untuk mengetahui rekomendasi peletakan berkas fisiknya.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Pilih Klasifikasi Surat</Label>
                                    <select 
                                        value={previewClassCode}
                                        onChange={(e) => setPreviewClassCode(e.target.value)}
                                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono text-sm"
                                    >
                                        {classifications.map((item) => (
                                            <option key={item.code} value={item.code}>
                                                {item.code} - {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mt-4 p-4 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Nama Folder / Map</span>
                                            <span className="text-sm font-bold text-slate-800 dark:text-white">
                                                {getFilingGuideline(previewClassCode).folder}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Kode Warna Binder</span>
                                            <Badge className="text-xs bg-slate-200 text-slate-800 dark:bg-zinc-900 dark:text-slate-300">
                                                {getFilingGuideline(previewClassCode).color}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
                                        <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Langkah Penyimpanan Fisik</span>
                                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 mt-1">
                                            {getFilingGuideline(previewClassCode).desc}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Modal Tambah Klasifikasi */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Tambah Klasifikasi Dinas</DialogTitle>
                        <DialogDescription>
                            Buat kode klasifikasi surat baru. Pastikan kode klasifikasi unik.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateClassification} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="create_code" className="text-sm font-semibold">Kode Klasifikasi</Label>
                            <Input
                                id="create_code"
                                placeholder="Contoh: 400.3.5.02 atau 421.1"
                                value={createCode}
                                onChange={(e) => setCreateCode(e.target.value)}
                                required
                                className="font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create_name" className="text-sm font-semibold">Nama Kategori / Tujuan Dinas</Label>
                            <Input
                                id="create_name"
                                placeholder="Contoh: Kepegawaian (PTK) atau Kurikulum"
                                value={createName}
                                onChange={(e) => setCreateName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create_desc" className="text-sm font-semibold">Deskripsi / Penjelasan Fungsi Kode</Label>
                            <Textarea
                                id="create_desc"
                                placeholder="Tuliskan penjelasan mengenai fungsi kode klasifikasi ini untuk apa saja..."
                                value={createDescription}
                                onChange={(e) => setCreateDescription(e.target.value)}
                                className="min-h-[100px] resize-none"
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={isCreating} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                                {isCreating ? "Menyimpan..." : "Tambah Klasifikasi"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Edit Klasifikasi */}
            <Dialog open={isEditOpen} onOpenChange={(open) => {
                setIsEditOpen(open);
                if (!open) setSelectedClass(null);
            }}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Edit Klasifikasi Dinas</DialogTitle>
                        <DialogDescription>
                            Perbarui detail atau status untuk kode klasifikasi <code className="font-mono bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-blue-600 font-bold">{selectedClass?.code}</code>.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateClassification} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit_code" className="text-sm font-semibold">Kode Klasifikasi</Label>
                            <Input
                                id="edit_code"
                                value={editCode}
                                onChange={(e) => setEditCode(e.target.value)}
                                required
                                className="font-mono bg-slate-50 dark:bg-zinc-950"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_name" className="text-sm font-semibold">Nama Kategori / Tujuan Dinas</Label>
                            <Input
                                id="edit_name"
                                placeholder="Contoh: Kepegawaian (PTK)"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit_desc" className="text-sm font-semibold">Deskripsi / Penjelasan Fungsi Kode</Label>
                            <Textarea
                                id="edit_desc"
                                placeholder="Tuliskan penjelasan mengenai fungsi kode klasifikasi ini untuk apa saja..."
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="min-h-[100px] resize-none"
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50 dark:bg-zinc-950/50">
                            <div className="space-y-0.5">
                                <Label htmlFor="edit_active" className="text-sm font-semibold">Status Aktif</Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Klasifikasi nonaktif tidak akan muncul saat membuat surat baru.
                                </p>
                            </div>
                            <Switch
                                id="edit_active"
                                checked={editIsActive}
                                onCheckedChange={setEditIsActive}
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setSelectedClass(null); }}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                                {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Konfirmasi Hapus Klasifikasi */}
            <Dialog open={isDeleteOpen} onOpenChange={(open) => {
                setIsDeleteOpen(open);
                if (!open) setClassToDelete(null);
            }}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Hapus Klasifikasi?
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            Apakah Anda yakin ingin menghapus kode klasifikasi <strong className="font-mono text-slate-800 dark:text-white">{classToDelete?.code}</strong> ({classToDelete?.name})?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-3 rounded-lg text-xs text-amber-800 dark:text-amber-300 leading-relaxed space-y-1">
                        <p className="font-bold">⚠️ Perhatian Pengarsipan:</p>
                        <p>
                            Jika kode klasifikasi ini sudah digunakan pada surat masuk atau surat keluar, sistem akan **menonaktifkannya secara otomatis** (soft delete) agar arsip lama tidak terputus relasinya. Jika belum digunakan, data akan dihapus permanen.
                        </p>
                    </div>
                    <DialogFooter className="pt-4 gap-2">
                        <Button type="button" variant="outline" onClick={() => { setIsDeleteOpen(false); setClassToDelete(null); }}>
                            Batal
                        </Button>
                        <Button 
                            type="button" 
                            disabled={isDeleting} 
                            onClick={handleDeleteClassification} 
                            className="bg-red-600 hover:bg-red-700 text-white font-medium"
                        >
                            {isDeleting ? "Menghapus..." : "Ya, Hapus"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function extractSequenceNumber(mailNumber: string, classCode: string): number {
    if (!mailNumber) return 1;
    const clean = mailNumber.trim();
    const slashIdx = clean.indexOf("/");
    if (slashIdx > 0) {
        const first = clean.substring(0, slashIdx);
        const val = parseInt(first);
        if (!isNaN(val) && val > 0 && first !== classCode) {
            return val;
        }
    }
    const parts = clean.split("/");
    for (const p of parts) {
        if (p === classCode || p.startsWith("400.3") || p.startsWith("421")) continue;
        const num = parseInt(p);
        if (!isNaN(num) && num > 0) return num;
    }
    return 1;
}
