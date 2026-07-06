"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
    ArrowLeft, 
    Loader2, 
    FileText, 
    Search, 
    Download,
    Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { goGet, goPost } from "@/lib/api-client";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { createDocumentBlob } from "@/lib/docx";

interface Template {
    id: string;
    name: string;
    category: string;
    filePath: string;
}

interface Student {
    id: string;
    fullName: string;
    className?: string;
    nis?: string;
    nisn?: string;
    gender?: string;
    birthPlace?: string;
    birthDate?: string;
    address?: string;
    parentName?: string;
    parentPhone?: string;
}

export default function CreateSchoolDocumentPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [docType, setDocType] = useState<string>("transkrip");
    const [docTitle, setDocTitle] = useState<string>("");
    
    // Student Search & Selection
    const [studentSearch, setStudentSearch] = useState<string>("");
    const [studentsList, setStudentsList] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
    
    const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
    const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
    
    const [schoolSettings, setSchoolSettings] = useState<any>(null);
    const [templateVars, setTemplateVars] = useState<string[]>([]);
    const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
    const [studentGrades, setStudentGrades] = useState<any[]>([]);
    
    const [loading, setLoading] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Fetch school settings and templates on mount
    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const [settingsRes, templatesRes] = await Promise.all([
                    goGet("/api/school-settings"),
                    goGet("/api/eoffice/letter-templates?limit=100")
                ]);
                setSchoolSettings(settingsRes.data || settingsRes);
                setTemplates(templatesRes.items || templatesRes.data || []);
            } catch (err) {
                console.error("Gagal memuat data awal:", err);
                toast.error("Gagal memuat data templat");
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    // Search students
    useEffect(() => {
        if (!studentSearch.trim()) {
            setStudentsList([]);
            return;
        }
        const searchStudents = async () => {
            setLoadingStudents(true);
            try {
                const res = await goGet(`/api/master/students/simple-search?q=${studentSearch}`);
                if (res.success) {
                    setStudentsList(res.data || []);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingStudents(false);
            }
        };
        const timer = setTimeout(searchStudents, 400);
        return () => clearTimeout(timer);
    }, [studentSearch]);

    // When template changes, fetch its variables
    useEffect(() => {
        if (!selectedTemplate) {
            setTemplateVars([]);
            setManualInputs({});
            return;
        }
        const loadVariables = async () => {
            try {
                const res = await goGet(`/api/eoffice/letter-templates/${selectedTemplate.id}/variables`);
                if (res.success) {
                    setTemplateVars(res.data || []);
                }
            } catch (err) {
                console.error(err);
            }
        };
        loadVariables();
    }, [selectedTemplate]);

    // When student changes, fetch grades if docType is transkrip
    useEffect(() => {
        if (!selectedStudent || docType !== "transkrip") {
            setStudentGrades([]);
            return;
        }
        const loadGrades = async () => {
            try {
                const res = await goGet(`/api/master/students/${selectedStudent.id}/grades`);
                if (res.success) {
                    setStudentGrades(res.data || []);
                }
            } catch (err) {
                console.error(err);
            }
        };
        loadGrades();
    }, [selectedStudent, docType]);

    // Autofill document title
    useEffect(() => {
        if (docType === "daftar_1") {
            const mName = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][reportMonth];
            setDocTitle(`Laporan Bulanan Sekolah Dasar (Daftar I) - ${mName} ${reportYear}`);
        } else {
            const typeLabel = docType === "transkrip" ? "Transkrip Nilai" : "Laporan";
            const recipientName = selectedStudent ? selectedStudent.fullName : "";
            if (recipientName) {
                setDocTitle(`${typeLabel} - ${recipientName}`);
            } else {
                setDocTitle(typeLabel);
            }
        }
    }, [docType, selectedStudent, reportMonth, reportYear]);

    // Auto-select template when docType changes
    useEffect(() => {
        if (docType === "daftar_1") {
            const found = templates.find(t => t.category === "DOCUMENT" || t.id === "daftar_1_template_id" || t.name.toLowerCase().includes("daftar i") || t.name.toLowerCase().includes("daftar 1"));
            if (found) {
                setSelectedTemplate(found);
            }
        } else if (docType === "transkrip") {
            const found = templates.find(t => t.name.toLowerCase().includes("transkrip"));
            if (found) {
                setSelectedTemplate(found);
            }
        }
    }, [docType, templates]);

    const getManualVars = () => {
        return templateVars.filter(v => {
            if (v.startsWith("siswa_") || v.startsWith("sekolah_") || v.startsWith("kepala_sekolah_") || v.startsWith("nilai_") || v === "tanggal_hari_ini" || v === "tahun_ajaran") {
                return false;
            }
            return true;
        });
    };

    const handleGenerateData = () => {
        const baseData: any = {};

        // Merge School Settings
        if (schoolSettings) {
            baseData.sekolah_nama = schoolSettings.school_name || "";
            baseData.sekolah_npsn = schoolSettings.school_npsn || "";
            baseData.sekolah_alamat = schoolSettings.school_address || "";
            baseData.sekolah_telepon = schoolSettings.school_phone || "";
            baseData.sekolah_email = schoolSettings.school_email || "";
            baseData.sekolah_website = schoolSettings.school_website || "";
            baseData.sekolah_kota = schoolSettings.school_city || schoolSettings.school_kabupaten || "";
            baseData.kepala_sekolah_nama = schoolSettings.principal_name || "";
            baseData.kepala_sekolah_nip = schoolSettings.principal_nip || "";
            baseData.tahun_ajaran = schoolSettings.current_academic_year || "";
        }
        baseData.tanggal_hari_ini = format(new Date(), "d MMMM yyyy", { locale: id });

        // Merge Student Info
        if (selectedStudent) {
            baseData.siswa_nama = selectedStudent.fullName;
            baseData.siswa_nis = selectedStudent.nis || "-";
            baseData.siswa_nisn = selectedStudent.nisn || "-";
            baseData.siswa_kelas = selectedStudent.className || "";
            baseData.siswa_jenis_kelamin = selectedStudent.gender === "L" ? "Laki-laki" : "Perempuan";
            baseData.siswa_tempat_lahir = selectedStudent.birthPlace || "";
            if (selectedStudent.birthDate) {
                const bDate = new Date(selectedStudent.birthDate);
                baseData.siswa_tanggal_lahir = format(bDate, "d MMMM yyyy", { locale: id });
                baseData.siswa_tanggal_lahir_indo = baseData.siswa_tanggal_lahir;
            }
            baseData.siswa_alamat = selectedStudent.address || "";
            baseData.siswa_nama_wali = selectedStudent.parentName || "";
            baseData.siswa_no_hp_wali = selectedStudent.parentPhone || "";
        }

        // Merge Student Grades
        if (studentGrades.length > 0) {
            let totalScore = 0;
            let totalCount = 0;
            const semesterTotals: Record<number, { sum: number; count: number }> = {};

            studentGrades.forEach((g: any) => {
                const varSubjectName = g.subject.toLowerCase()
                    .replace(/[^a-z0-9]/g, "_")
                    .replace(/_+/g, "_")
                    .replace(/^_+|_+$/g, "");
                
                baseData[`nilai_${varSubjectName}_sem_${g.semester}`] = g.avgScore;
                baseData[`nilai_${varSubjectName}_semester_${g.semester}`] = g.avgScore;

                totalScore += g.avgScore;
                totalCount++;
                if (!semesterTotals[g.semester]) {
                    semesterTotals[g.semester] = { sum: 0, count: 0 };
                }
                semesterTotals[g.semester].sum += g.avgScore;
                semesterTotals[g.semester].count++;
            });

            if (totalCount > 0) {
                baseData[`nilai_rata_rata`] = (totalScore / totalCount).toFixed(2);
            }
            Object.keys(semesterTotals).forEach(sem => {
                const s = Number(sem);
                const data = semesterTotals[s];
                baseData[`nilai_rata_rata_sem_${s}`] = (data.sum / data.count).toFixed(2);
                baseData[`nilai_rata_rata_semester_${s}`] = (data.sum / data.count).toFixed(2);
            });
        }

        // Merge Manual Inputs
        Object.keys(manualInputs).forEach(key => {
            baseData[key] = manualInputs[key];
        });

        return baseData;
    };

    const handleDownloadOnly = async () => {
        if (!selectedTemplate) {
            toast.error("Silakan pilih templat dokumen");
            return;
        }
        setSubmitting(true);
        const toastId = toast.loading("Membuat dokumen untuk diunduh...");
        try {
            let dataToRender: any = {};
            if (docType === "daftar_1") {
                const res = await goGet(`/api/arsip/daftar-1?month=${reportMonth}&year=${reportYear}`);
                if (res.success) {
                    dataToRender = res.data;
                } else {
                    throw new Error("Gagal mengambil data statistik Daftar 1");
                }
            } else {
                dataToRender = handleGenerateData();
            }
            Object.keys(manualInputs).forEach(key => {
                dataToRender[key] = manualInputs[key];
            });
            const blob = await createDocumentBlob(selectedTemplate.filePath, dataToRender);
            const fileName = `${docTitle.replace(/[\/\s\\:]/g, "_")}.docx`;
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            toast.success("Dokumen berhasil diunduh!");
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Gagal membuat dokumen");
        } finally {
            toast.dismiss(toastId);
            setSubmitting(false);
        }
    };

    const handleCreateDocument = async () => {
        if (!selectedTemplate) {
            toast.error("Silakan pilih templat dokumen");
            return;
        }
        if (docType === "transkrip" && !selectedStudent) {
            toast.error("Silakan pilih siswa penerima");
            return;
        }
        if (!docTitle.trim()) {
            toast.error("Judul dokumen tidak boleh kosong");
            return;
        }

        setSubmitting(true);
        const toastId = toast.loading("Memproses pembuatan dokumen...");
        try {
            let dataToRender: any = {};
            if (docType === "daftar_1") {
                const res = await goGet(`/api/arsip/daftar-1?month=${reportMonth}&year=${reportYear}`);
                if (res.success) {
                    dataToRender = res.data;
                } else {
                    throw new Error("Gagal mengambil data statistik Daftar 1");
                }
            } else {
                dataToRender = handleGenerateData();
            }

            // Merge Manual Inputs
            Object.keys(manualInputs).forEach(key => {
                dataToRender[key] = manualInputs[key];
            });
            
            // 1. Generate DOCX blob in client
            const blob = await createDocumentBlob(selectedTemplate.filePath, dataToRender);
            
            // 2. Upload file via API
            const fileName = `${docTitle.replace(/[\/\s\\:]/g, "_")}.docx`;
            const docxFile = new File([blob], fileName, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
            const uploadForm = new FormData();
            uploadForm.append("file", docxFile);
            
            const uploadResult: any = await goPost("/api/eoffice/upload-docx", uploadForm);
            const filePath = uploadResult?.filePath || uploadResult?.path || "";
            if (!filePath) throw new Error("Gagal mengunggah file");

            // 3. Register to DMS
            await goPost("/api/arsip/dokumen", {
                documentType: docType,
                title: docTitle,
                recipient: selectedStudent ? selectedStudent.fullName : "Sekolah / Umum",
                referenceId: docType === "daftar_1" ? null : (selectedStudent ? selectedStudent.id : null),
                filePath: filePath
            });

            toast.success("Dokumen berhasil dibuat dan diarsipkan!");
            router.push("/arsip/dokumen");
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Gagal membuat dokumen");
        } finally {
            toast.dismiss(toastId);
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Loading State */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-32 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                    <p className="text-xs text-muted-foreground font-semibold">Memuat data templat dan pengaturan...</p>
                </div>
            )}

            {!loading && (<>
            {/* Header Title Area */}
            <div className="flex items-center gap-3 border-b pb-5 border-slate-100 dark:border-zinc-800">
                <Button variant="ghost" size="icon" onClick={() => router.push("/arsip/dokumen")} className="rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-3">
                        Pembuat Dokumen Baru
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1 font-medium">
                        Buat transkrip atau laporan secara instan dari templat dan data database
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left: Input Form (Takes 2 cols) */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-slate-100 dark:border-zinc-800 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Konfigurasi Dokumen</CardTitle>
                            <CardDescription>Pilih tipe, penerima, dan templat dasar</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tipe Dokumen</Label>
                                    <select 
                                        value={docType}
                                        onChange={(e) => {
                                            setDocType(e.target.value);
                                            setSelectedStudent(null);
                                            setStudentSearch("");
                                        }}
                                        className="w-full h-10 px-3 py-2 border rounded-xl bg-background border-input text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <option value="transkrip">Transkrip Nilai</option>
                                        <option value="daftar_1">Laporan Bulanan (Daftar I)</option>
                                        <option value="laporan_kegiatan">Laporan Kegiatan</option>
                                        <option value="laporan_keuangan">Laporan Keuangan</option>
                                        <option value="lainnya">Laporan Lainnya</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Judul Arsip Dokumen</Label>
                                    <Input 
                                        placeholder="Judul dokumen..."
                                        value={docTitle}
                                        onChange={(e) => setDocTitle(e.target.value)}
                                        className="rounded-xl"
                                    />
                                </div>
                            </div>

                            {/* Template Selector */}
                            <div className="space-y-2">
                                <Label>Pilih Templat Dokumen Word (.docx)</Label>
                                <select 
                                    value={selectedTemplate?.id || ""}
                                    onChange={(e) => {
                                        const found = templates.find(t => t.id === e.target.value);
                                        setSelectedTemplate(found || null);
                                    }}
                                    className="w-full h-10 px-3 py-2 border rounded-xl bg-background border-input text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="">-- Pilih Templat --</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Student Search Box */}
                            {(docType === "transkrip" || docType === "laporan_kegiatan" || docType === "lainnya") && (
                                <div className="space-y-2 relative">
                                    <Label>{docType === "transkrip" ? "Pencarian Siswa Penerima" : "Siswa Terkait (Opsional)"}</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input 
                                            placeholder="Masukkan nama atau NIS siswa..."
                                            value={studentSearch}
                                            onChange={(e) => setStudentSearch(e.target.value)}
                                            className="pl-10 rounded-xl"
                                        />
                                    </div>

                                    {/* Search Results Dropdown */}
                                    {loadingStudents && (
                                        <div className="absolute z-10 w-full bg-background border rounded-xl p-3 shadow-md flex items-center justify-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                                            <span className="text-xs">Mencari siswa...</span>
                                        </div>
                                    )}
                                    {!loadingStudents && studentsList.length > 0 && (
                                        <ul className="absolute z-10 w-full max-h-48 overflow-y-auto bg-background border rounded-xl shadow-md divide-y">
                                            {studentsList.map(s => (
                                                <li 
                                                    key={s.id}
                                                    onClick={() => {
                                                        setSelectedStudent(s);
                                                        setStudentsList([]);
                                                        setStudentSearch("");
                                                    }}
                                                    className="p-3 hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer text-sm flex justify-between items-center"
                                                >
                                                    <span className="font-semibold text-slate-800 dark:text-zinc-200">{s.fullName}</span>
                                                    <span className="text-xs text-muted-foreground">Kelas {s.className || "-"} | NISN {s.nisn || "-"}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {/* Month & Year Selector for Daftar 1 */}
                            {docType === "daftar_1" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Bulan Laporan</Label>
                                        <select 
                                            value={reportMonth}
                                            onChange={(e) => setReportMonth(Number(e.target.value))}
                                            className="w-full h-10 px-3 py-2 border rounded-xl bg-background border-input text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <option value={1}>Januari</option>
                                            <option value={2}>Februari</option>
                                            <option value={3}>Maret</option>
                                            <option value={4}>April</option>
                                            <option value={5}>Mei</option>
                                            <option value={6}>Juni</option>
                                            <option value={7}>Juli</option>
                                            <option value={8}>Agustus</option>
                                            <option value={9}>September</option>
                                            <option value={10}>Oktober</option>
                                            <option value={11}>November</option>
                                            <option value={12}>Desember</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tahun Laporan</Label>
                                        <Input 
                                            type="number"
                                            value={reportYear}
                                            onChange={(e) => setReportYear(Number(e.target.value))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Student Selected Details Banner */}
                            {(docType === "transkrip" || docType === "laporan_kegiatan" || docType === "lainnya") && selectedStudent && (
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 dark:bg-zinc-900/40 dark:border-zinc-800 flex justify-between items-center">
                                    <div>
                                        <p className="text-xs text-muted-foreground font-semibold">Siswa Terpilih</p>
                                        <p className="font-bold text-slate-800 dark:text-zinc-100 mt-0.5">{selectedStudent.fullName}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">NIS: {selectedStudent.nis || "-"} | NISN: {selectedStudent.nisn || "-"}</p>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setSelectedStudent(null)} 
                                        className="rounded-xl"
                                    >
                                        Ganti
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Manual Inputs Card (if template has extra variables) */}
                    {selectedTemplate && getManualVars().length > 0 && (
                        <Card className="border-slate-100 dark:border-zinc-800 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Input Manual Tambahan</CardTitle>
                                <CardDescription>Isi variabel templat kustom berikut</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {getManualVars().map(variable => (
                                    <div key={variable} className="space-y-2">
                                        <Label className="capitalize">{variable.replace(/_/g, " ")}</Label>
                                        <Input 
                                            placeholder={`Nilai untuk {{${variable}}}`}
                                            value={manualInputs[variable] || ""}
                                            onChange={(e) => setManualInputs(prev => ({ ...prev, [variable]: e.target.value }))}
                                            className="rounded-xl"
                                        />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Side: Preview & Action Box */}
                <div className="space-y-6">
                    <Card className="border-slate-100 dark:border-zinc-800 shadow-sm sticky top-6">
                        <CardHeader>
                            <CardTitle className="text-lg">Rangkuman Data</CardTitle>
                            <CardDescription>Variabel data siap dimasukkan</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-xs space-y-2 border-b pb-4">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tipe Kategori:</span>
                                    <span className="font-bold uppercase text-slate-800 dark:text-zinc-200">{docType === "daftar_1" ? "Daftar 1 (Laporan Bulanan)" : docType}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Penerima/Sasaran:</span>
                                    <span className="font-bold text-slate-800 dark:text-zinc-200">{docType === "daftar_1" ? "Sekolah / Umum" : (selectedStudent?.fullName || "Umum")}</span>
                                </div>
                                {docType === "transkrip" && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total Mata Pelajaran:</span>
                                        <span className="font-bold text-slate-800 dark:text-zinc-200">{studentGrades.length}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 pt-2">
                                <Button 
                                    className="w-full gap-2 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-semibold shadow-sm border-0 transition-all rounded-xl"
                                    onClick={handleCreateDocument}
                                    disabled={submitting || !selectedTemplate}
                                >
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Simpan & Arsipkan Dokumen
                                </Button>
                                <Button 
                                    variant="outline"
                                    className="w-full gap-2 rounded-xl font-semibold"
                                    onClick={handleDownloadOnly}
                                    disabled={submitting || !selectedTemplate}
                                >
                                    <Download className="h-4 w-4" />
                                    Download Saja (Tanpa Arsip)
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>)}
        </div>
    );
}
