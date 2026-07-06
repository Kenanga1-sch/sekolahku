"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Settings,
  Eye,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Cpu,
  RefreshCw,
  Terminal as TerminalIcon,
  Check,
  XCircle,
} from "lucide-react";
import { goGet, goPost } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";

type ImportType = "profile" | "grade";
type ActiveTab = "excel" | "bridge";

interface TargetField {
  key: string;
  label: string;
  required: boolean;
  desc?: string;
}

const PROFILE_FIELDS: TargetField[] = [
  { key: "fullName", label: "Nama Lengkap", required: true, desc: "Nama lengkap siswa" },
  { key: "nickname", label: "Nama Panggilan", required: false, desc: "Nama panggilan sehari-hari" },
  { key: "nisn", label: "NISN", required: false, desc: "Nomor Induk Siswa Nasional (10 digit)" },
  { key: "nis", label: "NIS / No Induk", required: false, desc: "Nomor Induk Siswa" },
  { key: "nik", label: "NIK", required: false, desc: "Nomor Induk Kependudukan (16 digit)" },
  { key: "gender", label: "Jenis Kelamin", required: false, desc: "L (Laki-laki) atau P (Perempuan)" },
  { key: "birthPlace", label: "Tempat Lahir", required: false },
  { key: "birthDate", label: "Tanggal Lahir", required: false, desc: "Format: YYYY-MM-DD" },
  { key: "religion", label: "Agama", required: false },
  { key: "citizenship", label: "Kewarganegaraan", required: false, desc: "WNI atau WNA" },
  { key: "dailyLanguage", label: "Bahasa Keluarga", required: false, desc: "Bahasa sehari-hari" },
  { key: "livingWith", label: "Tinggal Bersama", required: false, desc: "Orangtua / Wali / Menumpang / Asrama" },
  { key: "address", label: "Alamat Lengkap", required: false },
  { key: "currentPhone", label: "No Telepon / HP", required: false },
  { key: "siblingKandung", label: "Saudara Kandung", required: false, desc: "Jumlah saudara kandung" },
  { key: "siblingTiri", label: "Saudara Tiri", required: false, desc: "Jumlah saudara tiri" },
  { key: "siblingAngkat", label: "Saudara Angkat", required: false, desc: "Jumlah saudara angkat" },
  { key: "fatherName", label: "Nama Ayah", required: false },
  { key: "fatherNik", label: "NIK Ayah", required: false },
  { key: "fatherEducation", label: "Pendidikan Ayah", required: false },
  { key: "fatherJob", label: "Pekerjaan Ayah", required: false },
  { key: "motherName", label: "Nama Ibu", required: false },
  { key: "motherNik", label: "NIK Ibu", required: false },
  { key: "motherEducation", label: "Pendidikan Ibu", required: false },
  { key: "motherJob", label: "Pekerjaan Ibu", required: false },
  { key: "guardianName", label: "Nama Wali", required: false },
  { key: "guardianNik", label: "NIK Wali", required: false },
  { key: "guardianRelation", label: "Hubungan Wali", required: false },
  { key: "guardianEducation", label: "Pendidikan Wali", required: false },
  { key: "guardianJob", label: "Pekerjaan Wali", required: false },
  { key: "guardianPhone", label: "No HP Wali", required: false },
  { key: "previousSchool", label: "Sekolah Asal (TK/SD)", required: false },
  { key: "previousSchoolAddress", label: "Alamat Sekolah Asal", required: false },
  { key: "previousSchoolCertNo", label: "No Ijazah / STTB Asal", required: false },
  { key: "previousSchoolCertDate", label: "Tanggal Ijazah Asal", required: false },
  { key: "mutasiMasukAsalSekolah", label: "Sekolah Asal Pindahan", required: false },
  { key: "mutasiMasukDariKelas", label: "Dari Kelas Pindahan", required: false },
  { key: "mutasiMasukDiterimaTanggal", label: "Diterima Tanggal", required: false },
  { key: "mutasiMasukDiKelas", label: "Diterima Di Kelas", required: false },
  { key: "scholarshipInfo", label: "Beasiswa", required: false },
  { key: "height", label: "Tinggi Badan (cm)", required: false },
  { key: "weight", label: "Berat Badan (kg)", required: false },
  { key: "bloodType", label: "Golongan Darah", required: false },
  { key: "medicalNotes", label: "Catatan Penyakit", required: false },
  { key: "specialNeeds", label: "Kelainan Jasmani", required: false },
  { key: "enrolledYear", label: "Tahun Masuk", required: false },
  { key: "status", label: "Status Siswa", required: false, desc: "active / graduated / transferred / dropped" },
];

const GRADE_FIELDS: TargetField[] = [
  { key: "nisn", label: "NISN Siswa", required: false, desc: "Untuk pencocokan profil siswa" },
  { key: "nis", label: "NIS Siswa", required: false, desc: "Untuk pencocokan profil siswa" },
  { key: "fullName", label: "Nama Siswa", required: false, desc: "Pencocokan nama (case-insensitive)" },
  { key: "academicYear", label: "Tahun Ajaran", required: true, desc: "Format: YYYY/YYYY (misal 2026/2027)" },
  { key: "semester", label: "Semester", required: true, desc: "Ganjil atau Genap" },
  { key: "subjectName", label: "Nama Mapel", required: true, desc: "Misalnya: Matematika, Bahasa Indonesia, Mangrove" },
  { key: "score", label: "Nilai Angka", required: true, desc: "Skala 0 - 100" },
  { key: "notes", label: "Deskripsi/Catatan", required: false, desc: "Deskripsi capaian nilai rapor" },
];

export default function ImportWizardPage() {
  const router = useRouter();

  // Tab Navigation: excel = File-based Excel Import, bridge = API Bridge
  const [activeTab, setActiveTab] = useState<ActiveTab>("excel");

  // ==========================================
  // TAB 1: EXCEL IMPORT STATE
  // ==========================================
  const [step, setStep] = useState<number>(1);
  const [importType, setImportType] = useState<ImportType>("profile");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [mappedPreview, setMappedPreview] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    updated: number;
    logs: string[];
  } | null>(null);

  const targetFields = importType === "profile" ? PROFILE_FIELDS : GRADE_FIELDS;

  // ==========================================
  // TAB 2: API BRIDGE STATE
  // ==========================================
  const [dapodikUrl, setDapodikUrl] = useState("http://localhost:5774");
  const [dapodikToken, setDapodikToken] = useState("");
  const [dapodikNpsn, setDapodikNpsn] = useState("");
  const [eraporUrl, setEraporUrl] = useState("http://localhost:8080");
  const [eraporToken, setEraporToken] = useState("");
  const [isSandbox, setIsSandbox] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncResult, setSyncResult] = useState<{ success: boolean; inserted: number; updated: number } | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Fetch Saved Settings
  useEffect(() => {
    fetchBridgeSettings();
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [syncLogs]);

  const fetchBridgeSettings = async () => {
    try {
      const res: any = await goGet("/api/integrations/settings");
      if (res && res.data) {
        setDapodikUrl(res.data.dapodikUrl || "http://localhost:5774");
        setDapodikToken(res.data.dapodikToken || "");
        setDapodikNpsn(res.data.dapodikNpsn || "");
        setEraporUrl(res.data.eraporUrl || "http://localhost:8080");
        setEraporToken(res.data.eraporToken || "");
        setIsSandbox(res.data.isSandbox !== undefined ? res.data.isSandbox : true);
      }
    } catch (err) {
      console.error("Gagal memuat pengaturan integrasi:", err);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await goPost("/api/integrations/settings", {
        dapodikUrl,
        dapodikToken,
        dapodikNpsn,
        eraporUrl,
        eraporToken,
        isSandbox,
      });
      showSuccess("Pengaturan integrasi berhasil disimpan!");
      setTestResult(null);
    } catch (err: any) {
      showError(err.message || "Gagal menyimpan pengaturan");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setTestResult(null);
    try {
      const res: any = await goPost("/api/integrations/test-connection", {
        dapodikUrl,
        dapodikToken,
        dapodikNpsn,
        eraporUrl,
        eraporToken,
        isSandbox,
      });
      if (res.success) {
        setTestResult({
          success: true,
          msg: `Koneksi berhasil! Dapodik: ${res.dapodik}, e-Rapor: ${res.erapor}`,
        });
        showSuccess("Uji koneksi berhasil!");
      } else {
        setTestResult({
          success: false,
          msg: res.error || "Gagal menghubungi server lokal",
        });
        showError("Uji koneksi gagal!");
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        msg: err.message || "Gagal memproses uji koneksi",
      });
      showError("Gagal menguji koneksi");
    } finally {
      setIsTestingConn(false);
    }
  };

  const startSync = async () => {
    setIsSyncing(true);
    setSyncProgress(10);
    setSyncLogs(["[Console] Menginisialisasi proses sinkronisasi...", "[Console] Menyimpan konfigurasi aktif..."]);
    setSyncResult(null);

    try {
      // Auto save settings first
      await goPost("/api/integrations/settings", {
        dapodikUrl,
        dapodikToken,
        dapodikNpsn,
        eraporUrl,
        eraporToken,
        isSandbox,
      });

      setSyncProgress(30);
      setSyncLogs((prev) => [...prev, "[Console] Konfigurasi disimpan. Menghubungkan ke API Jembatan Lokal..."]);

      // Run sync endpoint
      const res: any = await goPost("/api/integrations/sync", {});
      
      // Simulate real-time scrolling logs by writing them sequentially
      if (res.logs && res.logs.length > 0) {
        let currentIdx = 0;
        const interval = setInterval(() => {
          if (currentIdx < res.logs.length) {
            setSyncLogs((prev) => [...prev, res.logs[currentIdx]]);
            setSyncProgress((prev) => Math.min(prev + 10, 95));
            currentIdx++;
          } else {
            clearInterval(interval);
            setSyncProgress(100);
            setSyncResult({
              success: res.success,
              inserted: res.inserted ?? 0,
              updated: res.updated ?? 0,
            });
            setIsSyncing(false);
            if (res.success) {
              showSuccess("Sinkronisasi massal selesai!");
            } else {
              showError("Sinkronisasi selesai dengan beberapa error/warning.");
            }
          }
        }, 300);
      } else {
        setSyncProgress(100);
        setIsSyncing(false);
        if (res.success) {
          setSyncResult({ success: true, inserted: res.inserted, updated: res.updated });
          showSuccess("Sinkronisasi selesai!");
        } else {
          showError(res.error || "Gagal sinkronisasi");
        }
      }

    } catch (err: any) {
      setSyncLogs((prev) => [...prev, `[ERROR] Proses terhenti: ${err.message}`]);
      setIsSyncing(false);
      setSyncProgress(0);
      showError(err.message || "Terjadi kesalahan sinkronisasi");
    }
  };

  // ==========================================
  // TAB 1: EXCEL FUZZY MATCH LOGIC
  // ==========================================
  const runAutoDetect = (excelHeaders: string[]) => {
    const newMappings: Record<string, string> = {};

    const dictionary: Record<string, string[]> = {
      fullName: ["nama", "namalengkap", "nama_lengkap", "nama_siswa", "namasiswa", "studentname", "full_name"],
      nickname: ["panggilan", "namapanggilan", "nama_panggilan", "nickname"],
      nisn: ["nisn", "n.i.s.n", "nisn_siswa"],
      nis: ["nis", "n.i.s", "nomorinduk", "no_induk", "noinduk", "student_id", "id_siswa"],
      nik: ["nik", "n.i.k", "nomorktp", "no_ktp", "noktp", "national_id"],
      gender: ["jeniskelamin", "jk", "j_k", "sex", "kelamin", "gender"],
      birthPlace: ["tempatlahir", "tempat_lahir", "tmplahir", "birth_place"],
      birthDate: ["tanggallahir", "tanggal_lahir", "tgllahir", "birth_date"],
      religion: ["agama", "religion"],
      citizenship: ["kewarganegaraan", "citizenship", "warga_negara"],
      dailyLanguage: ["bahasa", "bahasaseharihari", "bahasa_keluarga", "daily_language"],
      livingWith: ["tinggal", "tinggalbersama", "tinggal_dengan", "living_with"],
      address: ["alamat", "alamattinggal", "alamat_tinggal", "address"],
      currentPhone: ["notelpon", "notelepon", "nohp", "no_hp", "telepon", "phone"],
      siblingKandung: ["saudarakandung", "sibling_kandung"],
      fatherName: ["namaayah", "nama_ayah", "ayah", "father_name"],
      motherName: ["namaibu", "nama_ibu", "ibu", "mother_name"],
      academicYear: ["tahunajaran", "tahun_ajaran", "thnajaran", "thn_ajaran", "tahunakademik", "tahun_akademik", "academic_year", "tahunaer"],
      semester: ["semester", "smt", "term"],
      subjectName: ["matapelajaran", "mata_pelajaran", "mapel", "pelajaran", "subject_name", "subject"],
      score: ["nilai", "skor", "nilai_angka", "nilaiangka", "score", "grade"],
      notes: ["catatan", "keterangan", "deskripsi", "notes", "description"],
    };

    targetFields.forEach((field) => {
      const aliases = dictionary[field.key] || [field.key.toLowerCase()];
      const match = excelHeaders.find((h) => {
        const normH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
        return aliases.some((alias) => {
          const normA = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
          return normH === normA || normH.includes(normA) || normA.includes(normH);
        });
      });
      if (match) {
        newMappings[field.key] = match;
      }
    });

    setMappings(newMappings);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (rows.length === 0) {
          showError("Berkas Excel kosong atau tidak terbaca!");
          return;
        }

        const fileHeaders = Object.keys(rows[0]);
        setHeaders(fileHeaders);
        setRawData(rows);
        runAutoDetect(fileHeaders);
        setStep(2);
      } catch (err: any) {
        showError(`Gagal membaca berkas: ${err.message}`);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleMappingChange = (targetKey: string, excelHeader: string) => {
    setMappings((prev) => ({
      ...prev,
      [targetKey]: excelHeader,
    }));
  };

  const generatePreview = () => {
    const previewList: any[] = [];
    const errorsList: string[] = [];

    rawData.forEach((row, idx) => {
      const mappedRow: Record<string, any> = {};
      
      targetFields.forEach((field) => {
        const excelHeader = mappings[field.key];
        let val = excelHeader ? row[excelHeader] : undefined;
        
        if (val !== undefined && typeof val === "string") {
          val = val.trim();
        }
        mappedRow[field.key] = val;
      });

      if (importType === "profile") {
        if (!mappedRow.fullName) {
          errorsList.push(`Baris ${idx + 1}: Nama Lengkap wajib diisi.`);
        }
        ["siblingKandung", "siblingTiri", "siblingAngkat"].forEach((col) => {
          if (mappedRow[col]) {
            const parsed = parseInt(mappedRow[col], 10);
            mappedRow[col] = isNaN(parsed) ? 0 : parsed;
          } else {
            mappedRow[col] = 0;
          }
        });
        ["height", "weight"].forEach((col) => {
          if (mappedRow[col]) {
            const parsed = parseInt(mappedRow[col], 10);
            mappedRow[col] = isNaN(parsed) ? null : parsed;
          } else {
            mappedRow[col] = null;
          }
        });
      } else {
        if (!mappedRow.nisn && !mappedRow.nis && !mappedRow.fullName) {
          errorsList.push(`Baris ${idx + 1}: Identitas siswa (NISN, NIS, atau Nama) wajib ada.`);
        }
        if (!mappedRow.academicYear) {
          errorsList.push(`Baris ${idx + 1}: Tahun Ajaran wajib diisi.`);
        }
        if (!mappedRow.semester) {
          errorsList.push(`Baris ${idx + 1}: Semester wajib diisi.`);
        }
        if (!mappedRow.subjectName) {
          errorsList.push(`Baris ${idx + 1}: Nama Mata Pelajaran wajib diisi.`);
        }
        
        if (mappedRow.score === undefined || mappedRow.score === "") {
          errorsList.push(`Baris ${idx + 1}: Nilai Angka wajib diisi.`);
        } else {
          const parsedScore = parseFloat(mappedRow.score);
          if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100) {
            errorsList.push(`Baris ${idx + 1}: Nilai Angka harus berupa angka antara 0 - 100.`);
          } else {
            mappedRow.score = parsedScore;
          }
        }
      }

      previewList.push(mappedRow);
    });

    setMappedPreview(previewList);
    setValidationErrors(errorsList);
    setStep(3);
  };

  const processImport = async () => {
    setIsSubmitting(true);
    setProgress(20);
    try {
      if (importType === "profile") {
        setProgress(40);
        const res: any = await goPost("/api/alumni/import-bulk", { alumni: mappedPreview });
        setProgress(100);
        setImportResult({
          inserted: res.inserted ?? 0,
          updated: res.updated ?? 0,
          logs: res.logs ?? [],
        });
        showSuccess("Berhasil mengimpor data profil Buku Induk!");
      } else {
        setProgress(40);
        const res: any = await goPost("/api/alumni/import-grades-bulk", { grades: mappedPreview });
        setProgress(100);
        setImportResult({
          inserted: res.inserted ?? 0,
          updated: res.updated ?? 0,
          logs: res.logs ?? [],
        });
        showSuccess("Berhasil mengimpor nilai rapor siswa!");
      }
      setStep(4);
    } catch (err: any) {
      showError(err.message || "Gagal melakukan impor data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setFile(null);
    setHeaders([]);
    setRawData([]);
    setMappings({});
    setMappedPreview([]);
    setValidationErrors([]);
    setImportResult(null);
    setProgress(0);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-zinc-900 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-100/30 dark:border-zinc-800">
              <Upload className="h-6 w-6" />
            </div>
            Impor & Integrasi Data
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Impor data massal kesiswaan via berkas Excel atau sinkronisasi asinkron langsung via Jembatan API Dapodik/e-Rapor.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/admin/siswa?tab=alumni")} className="h-9">
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali ke Buku Induk
        </Button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-100 dark:border-zinc-800 p-1.5 bg-slate-50/50 dark:bg-zinc-950/20 rounded-xl gap-2 max-w-md">
        <button
          onClick={() => setActiveTab("excel")}
          className={`flex-1 py-2 px-4 text-xs md:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "excel"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-zinc-900/30"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Ekspor Berkas Excel/CSV
        </button>
        <button
          onClick={() => setActiveTab("bridge")}
          className={`flex-1 py-2 px-4 text-xs md:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "bridge"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-zinc-900/30"
          }`}
        >
          <Cpu className="h-4 w-4" />
          Jembatan API Lokal (Bridge)
        </button>
      </div>

      {/* TAB 1: EXCEL WIZARD VIEW */}
      {activeTab === "excel" && (
        <div className="space-y-6">
          {/* Progress Wizard Header */}
          <div className="relative flex justify-between items-center max-w-md mx-auto py-4">
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-100 dark:bg-zinc-800 -translate-y-1/2 z-0" />
            <div
              className="absolute left-0 top-1/2 h-0.5 bg-indigo-500 -translate-y-1/2 transition-all duration-300 z-0"
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            />
            {[
              { label: "Upload", icon: Upload },
              { label: "Mapping", icon: Settings },
              { label: "Preview", icon: Eye },
              { label: "Result", icon: CheckCircle2 },
            ].map((item, idx) => {
              const ActiveIcon = item.icon;
              const isDone = step > idx + 1;
              const isActive = step === idx + 1;

              return (
                <div key={idx} className="relative z-10 flex flex-col items-center gap-1.5">
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                      isDone
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : isActive
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg ring-4 ring-indigo-100 dark:ring-indigo-950/50"
                        : "bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600"
                    }`}
                  >
                    <ActiveIcon className="h-4 w-4" />
                  </div>
                  <span
                    className={`text-[10px] font-semibold tracking-wider uppercase transition-colors duration-200 ${
                      isActive || isDone ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-zinc-500"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              {step === 1 && (
                <Card className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 shadow-xl overflow-hidden">
                  <CardHeader>
                    <CardTitle>Langkah 1: Unggah Berkas & Pilih Tipe Impor</CardTitle>
                    <CardDescription>
                      Pilih tipe data yang ingin Anda impor kemudian unggah berkas excel hasil ekspor Dapodik atau e-Rapor.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        {
                          id: "profile",
                          title: "Profil Buku Induk Siswa",
                          desc: "Impor biodata siswa, alamat, keterangan orang tua/wali, riwayat sekolah asal, beasiswa, dan data kesehatan.",
                        },
                        {
                          id: "grade",
                          title: "Nilai Rapor Semester",
                          desc: "Impor data nilai transkrip rapor per semester siswa aktif berdasarkan subjek mata pelajaran.",
                        },
                      ].map((type) => (
                        <div
                          key={type.id}
                          onClick={() => setImportType(type.id as ImportType)}
                          className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                            importType === type.id
                              ? "border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/10 shadow-md scale-[1.01]"
                              : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-950/10"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-base">{type.title}</h3>
                            {importType === type.id && (
                              <Badge className="bg-indigo-600 hover:bg-indigo-600 text-white">Terpilih</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{type.desc}</p>
                        </div>
                      ))}
                    </div>

                    <div className="border-2 border-dashed border-slate-200 dark:border-zinc-800 hover:border-indigo-500/60 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 transition-all duration-300 bg-slate-50/30 dark:bg-zinc-950/5 relative">
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="h-16 w-16 rounded-full bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <FileSpreadsheet className="h-8 w-8" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold">Tarik & Lepas file Excel / CSV di sini</p>
                        <p className="text-xs text-muted-foreground mt-1">atau klik untuk menelusuri file komputer Anda</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                        Format: .xlsx, .xls, .csv
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {step === 2 && (
                <Card className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 shadow-xl">
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle>Langkah 2: Pemetaan Kolom Berkas ke Database</CardTitle>
                      <CardDescription>
                        Cocokkan kolom dari file unggahan (kiri) dengan field target database Buku Induk (kanan).
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={resetWizard} className="h-8">
                      <RotateCcw className="h-3 w-3 mr-1.5" /> Ulangi
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-700 dark:text-amber-400">
                      <Sparkles className="h-5 w-5 shrink-0 text-amber-500" />
                      <div className="text-xs space-y-1">
                        <span className="font-semibold">Auto-Detect Aktif!</span>
                        <p className="leading-relaxed">
                          Sistem telah mencocokkan kolom secara otomatis berdasarkan kemiripan nama header. Pastikan untuk meninjau kembali pemetaan di bawah.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-2 scrollbar-thin">
                      {targetFields.map((field) => {
                        const isMapped = !!mappings[field.key];
                        return (
                          <div
                            key={field.key}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-4 transition-colors ${
                              isMapped
                                ? "bg-emerald-500/5 border-emerald-500/20"
                                : field.required
                                ? "bg-red-500/5 border-red-500/20"
                                : "bg-slate-50/50 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800"
                            }`}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold truncate">{field.label}</span>
                                {field.required && (
                                  <Badge variant="destructive" className="text-[9px] h-4 px-1 shadow-none">
                                    Wajib
                                  </Badge>
                                )}
                              </div>
                              {field.desc && (
                                <p className="text-[10px] text-muted-foreground truncate">{field.desc}</p>
                              )}
                            </div>

                            <div className="w-1/2">
                              <Select
                                value={mappings[field.key] || "__skip__"}
                                onValueChange={(val) => handleMappingChange(field.key, val === "__skip__" ? "" : val)}
                              >
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="-- Lewati Kolom --" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__skip__" className="text-xs text-red-500 font-medium">
                                    -- Lewati Kolom --
                                  </SelectItem>
                                  {headers.map((h) => (
                                    <SelectItem key={h} value={h} className="text-xs">
                                      {h}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-zinc-800 pt-4">
                      <Button variant="ghost" onClick={resetWizard} className="h-9">
                        Batal
                      </Button>
                      <Button
                        onClick={generatePreview}
                        disabled={targetFields.some((f) => f.required && !mappings[f.key])}
                        className="h-9"
                      >
                        Lanjut Ke Pratinjau <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {step === 3 && (
                <Card className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 shadow-xl">
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle>Langkah 3: Pratinjau & Validasi Data</CardTitle>
                      <CardDescription>
                        Periksa kembali data hasil pemetaan. Terdapat {mappedPreview.length} baris data siap impor.
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setStep(2)} className="h-8">
                      Edit Pemetaan
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {validationErrors.length > 0 ? (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 animate-bounce" />
                        <div className="text-xs space-y-1.5 flex-1">
                          <span className="font-bold">Ditemukan {validationErrors.length} Masalah Validasi:</span>
                          <ul className="list-disc pl-4 space-y-0.5 max-h-[100px] overflow-y-auto leading-relaxed">
                            {validationErrors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                          <p className="font-semibold mt-1">
                            Saran: Anda dapat mengabaikan masalah ini (baris salah akan dilewati) atau mengedit format file Excel Anda dahulu.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                        <div className="text-xs">
                          <span className="font-bold">Semua data valid!</span>
                          <p className="mt-0.5">Seluruh baris lolos validasi client-side dan siap untuk dimasukkan ke database.</p>
                        </div>
                      </div>
                    )}

                    <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                      <Table className="text-xs">
                        <TableHeader className="bg-slate-50/50 dark:bg-zinc-950/20 sticky top-0 backdrop-blur-sm z-10">
                          <TableRow>
                            <TableHead className="w-12 text-center">No</TableHead>
                            {targetFields
                              .filter((f) => mappings[f.key])
                              .map((field) => (
                                <TableHead key={field.key} className="font-semibold">
                                  {field.label}
                                </TableHead>
                              ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mappedPreview.slice(0, 15).map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-center font-medium text-muted-foreground">{idx + 1}</TableCell>
                              {targetFields
                                .filter((f) => mappings[f.key])
                                .map((field) => {
                                  const cellVal = row[field.key];
                                  return (
                                    <TableCell key={field.key}>
                                      {cellVal === null || cellVal === undefined || cellVal === "" ? (
                                        <span className="text-slate-300 dark:text-zinc-700 italic">-</span>
                                      ) : (
                                        String(cellVal)
                                      )}
                                    </TableCell>
                                  );
                                })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-zinc-800 pt-4">
                      <Button variant="ghost" onClick={() => setStep(2)} className="h-9">
                        Kembali
                      </Button>
                      <Button onClick={processImport} disabled={isSubmitting} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white">
                        {isSubmitting ? "Mengunggah..." : "Mulai Impor Ke Database"} <Play className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {step === 4 && (
                <Card className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      Impor Berhasil Diselesaikan!
                    </CardTitle>
                    <CardDescription>
                      Proses impor massal data kesiswaan telah selesai dikerjakan oleh backend server.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-indigo-50/30 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-800 text-center">
                        <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                          {importResult?.inserted}
                        </span>
                        <p className="text-xs font-semibold text-muted-foreground mt-1">Data Baru Ditambahkan</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-emerald-50/30 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-800 text-center">
                        <span className="text-3xl font-extrabold text-emerald-500">
                          {importResult?.updated}
                        </span>
                        <p className="text-xs font-semibold text-muted-foreground mt-1">Data Siswa Diperbarui</p>
                      </div>
                    </div>

                    {importResult?.logs && importResult.logs.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" /> Log Peringatan Impor ({importResult.logs.length}):
                        </span>
                        <div className="border border-slate-200 dark:border-zinc-800 rounded-xl p-3 bg-slate-50/30 dark:bg-zinc-950/20 max-h-[150px] overflow-y-auto text-xs font-mono space-y-1">
                          {importResult.logs.map((log, idx) => (
                            <p key={idx} className="text-muted-foreground">
                              {log}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-zinc-800 pt-4">
                      <Button variant="outline" onClick={resetWizard} className="h-9">
                        <RotateCcw className="h-4 w-4 mr-2" /> Impor Berkas Lain
                      </Button>
                      <Button onClick={() => router.push("/admin/siswa?tab=alumni")} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white">
                        Kembali Ke Halaman Buku Induk
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* TAB 2: LOCAL API BRIDGE VIEW */}
      {activeTab === "bridge" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bridge Settings Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md border border-white/20 dark:border-zinc-800/50 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-indigo-600" />
                    Konfigurasi API Jembatan (Bridge)
                  </CardTitle>
                  <CardDescription>
                    Pengaturan port dan token autentikasi aplikasi Dapodik lokal dan e-Rapor.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="sandbox-toggle" className="text-xs font-bold text-muted-foreground">
                    Mode Sandbox
                  </Label>
                  <Switch
                    id="sandbox-toggle"
                    checked={isSandbox}
                    onCheckedChange={setIsSandbox}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isSandbox && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-700 dark:text-amber-400">
                    <Sparkles className="h-5 w-5 shrink-0 text-amber-500 animate-spin-slow" />
                    <div className="text-xs">
                      <span className="font-bold">Mode Sandbox (Simulasi) Aktif</span>
                      <p className="mt-0.5 leading-relaxed text-[11px]">
                        Uji koneksi dan sinkronisasi akan disimulasikan di localhost dengan data demo tanpa memerlukan server Dapodik/e-Rapor riil.
                      </p>
                    </div>
                  </div>
                )}

                {/* Dapodik Block */}
                <div className="space-y-4 border-b border-slate-100 dark:border-zinc-800/80 pb-6">
                  <Badge className="bg-indigo-600/10 text-indigo-600 hover:bg-indigo-600/15 border-indigo-500/10 font-bold mb-2">
                    DAPODIK WEB SERVICES
                  </Badge>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">URL Web Service Dapodik</Label>
                      <Input
                        type="url"
                        placeholder="http://localhost:5774"
                        value={dapodikUrl}
                        onChange={(e) => setDapodikUrl(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">NPSN Sekolah</Label>
                      <Input
                        type="text"
                        placeholder="12345678"
                        value={dapodikNpsn}
                        onChange={(e) => setDapodikNpsn(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs font-semibold">Token Web Service Dapodik</Label>
                      <Input
                        type="password"
                        placeholder="Masukkan kunci API Token Dapodik..."
                        value={dapodikToken}
                        onChange={(e) => setDapodikToken(e.target.value)}
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* e-Rapor Block */}
                <div className="space-y-4">
                  <Badge className="bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/15 border-emerald-500/10 font-bold mb-2">
                    E-RAPOR LOCAL SERVICES
                  </Badge>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs font-semibold">URL API e-Rapor</Label>
                      <Input
                        type="url"
                        placeholder="http://localhost:8080"
                        value={eraporUrl}
                        onChange={(e) => setEraporUrl(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs font-semibold">Token e-Rapor (API / DB Access Token)</Label>
                      <Input
                        type="password"
                        placeholder="Masukkan token akses e-Rapor..."
                        value={eraporToken}
                        onChange={(e) => setEraporToken(e.target.value)}
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Save and Test Actions */}
                <div className="flex justify-between items-center border-t border-slate-100 dark:border-zinc-800 pt-4 gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTestingConn || isSyncing}
                    className="h-9 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {isTestingConn ? (
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-violet-600" />
                    )}
                    Uji Koneksi
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings || isSyncing}
                      className="h-9 text-xs cursor-pointer"
                    >
                      {isSavingSettings ? "Menyimpan..." : "Simpan Pengaturan"}
                    </Button>
                    <Button
                      onClick={startSync}
                      disabled={isSyncing}
                      className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Mulai Sinkronisasi
                    </Button>
                  </div>
                </div>

                {/* Connection Test Log Alert */}
                {testResult && (
                  <div
                    className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                      testResult.success
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {testResult.success ? (
                      <Check className="h-5 w-5 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                    )}
                    <span className="font-mono break-all">{testResult.msg}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Retro Console / Terminal Log Panel */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-zinc-950 border border-zinc-800 text-zinc-100 shadow-2xl rounded-2xl overflow-hidden h-full flex flex-col min-h-[450px]">
              <CardHeader className="border-b border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TerminalIcon className="h-4 w-4 text-emerald-500 animate-pulse" />
                    <span className="text-xs font-mono font-bold tracking-wider text-zinc-400">
                      Retro Console
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-zinc-700 text-zinc-400 font-mono">
                    {isSyncing ? "SYNC_RUNNING" : "STANDBY"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 flex-1 flex flex-col font-mono text-[10px] space-y-2 overflow-y-auto leading-relaxed select-text min-h-[350px]">
                {syncLogs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-2">
                    <TerminalIcon className="h-8 w-8 opacity-30" />
                    <p className="italic">Console idle. Klik "Mulai Sinkronisasi" untuk memicu data bridge.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 flex-1">
                    {syncLogs.map((log, idx) => (
                      <p
                        key={idx}
                        className={
                          log.includes("[ERROR]")
                            ? "text-red-400 font-bold"
                            : log.includes("warning") || log.includes("Warning")
                            ? "text-amber-400"
                            : log.includes("berhasil") || log.includes("sukses") || log.includes("OK")
                            ? "text-emerald-400 font-semibold"
                            : "text-zinc-300"
                        }
                      >
                        {log}
                      </p>
                    ))}
                    {isSyncing && (
                      <span className="inline-block h-3 w-1.5 bg-emerald-500 animate-pulse ml-0.5" />
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                )}

                {/* Final result overlay banner inside console */}
                {syncResult && (
                  <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/50 mt-4 space-y-1 text-zinc-300">
                    <p className="text-emerald-400 font-bold">» PROSES SINKRONISASI SELESAI</p>
                    <p>• Data Siswa Ditambah: <span className="font-bold text-white">{syncResult.inserted}</span></p>
                    <p>• Transkrip Nilai Diperbarui: <span className="font-bold text-white">{syncResult.updated}</span></p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Uploading / Syncing Global Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-white dark:bg-zinc-950 shadow-2xl border-none p-6 text-center space-y-6">
            <div className="relative h-20 w-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-zinc-800" />
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Memproses Berkas Massal</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Sedang mengunggah dan menyelaraskan data dengan database SQLite. Jangan tutup halaman ini.
              </p>
            </div>
            <div className="space-y-1">
              <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-indigo-600"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{progress}% selesai</span>
            </div>
          </Card>
        </div>
      )}

      {/* Syncing Progress Bar overlay for API sync */}
      {isSyncing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-white dark:bg-zinc-950 shadow-2xl border-none p-6 text-center space-y-6">
            <div className="relative h-20 w-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-zinc-800" />
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Sinkronisasi Jembatan API</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Mengekstrak data dari Dapodik & e-Rapor lokal. Mohon tunggu, proses asinkron sedang berjalan...
              </p>
            </div>
            <div className="space-y-1">
              <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-indigo-600"
                  initial={{ width: "0%" }}
                  animate={{ width: `${syncProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{syncProgress}% selesai</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
