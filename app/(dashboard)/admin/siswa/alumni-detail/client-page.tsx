"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft,
  Edit,
  Trash2,
  GraduationCap,
  User,
  FileText,
  History,
  Phone,
  Mail,
  MapPin,
  School,
  Calendar,
  BookOpen,
  Trophy,
  Activity,
  Plus,
  Printer,
  Loader2,
  Award,
  Heart,
  Users,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { DocumentUpload } from "@/components/alumni/document-upload";
import { PickupForm } from "@/components/alumni/pickup-form";
import { DocumentGallery } from "@/components/alumni/document-gallery";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";

interface AlumniHealthRecord {
  id: string;
  alumniId: string;
  year: string;
  weight: number | null;
  height: number | null;
  illness: string | null;
  abnormality: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface AlumniDetail {
  id: string;
  studentId: string | null;
  nisn: string | null;
  nis: string | null;
  nik: string | null;
  fullName: string;
  gender: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  religion: string | null;
  address: string | null;
  enrolledYear: string | null;
  previousSchool: string | null;
  graduationYear: string;
  graduationDate: Date | null;
  finalClass: string | null;
  finalGradeAvg: number | null;
  photo: string | null;
  parentName: string | null;
  parentPhone: string | null;
  fatherName: string | null;
  fatherNik: string | null;
  fatherEducation: string | null;
  fatherJob: string | null;
  motherName: string | null;
  motherNik: string | null;
  motherEducation: string | null;
  motherJob: string | null;
  guardianName: string | null;
  guardianNik: string | null;
  guardianRelation: string | null;
  guardianJob: string | null;
  guardianPhone: string | null;
  siblingCount: number | null;
  childOrder: number | null;
  height: number | null;
  weight: number | null;
  bloodType: string | null;
  medicalNotes: string | null;
  specialNeeds: string | null;
  currentAddress: string | null;
  currentPhone: string | null;
  currentEmail: string | null;
  nextSchool: string | null;
  currentOccupation: string | null;
  currentInstitution: string | null;
  lastEducationLevel: string | null;
  notes: string | null;
  status: string;
  documents: AlumniDocument[];
  pickups: DocumentPickup[];
  transcripts: AlumniTranscript[];
  achievements: AlumniAchievement[];
  extracurriculars: AlumniExtracurricular[];
  attendanceSummaries: AlumniAttendanceSummary[];
  
  // enhanced physical register fields
  nickname: string | null;
  citizenship: string | null;
  siblingKandung: number;
  siblingTiri: number;
  siblingAngkat: number;
  dailyLanguage: string | null;
  livingWith: string | null;
  guardianEducation: string | null;
  previousSchoolAddress: string | null;
  previousSchoolCertNo: string | null;
  previousSchoolCertDate: string | null;
  mutasiMasukAsalSekolah: string | null;
  mutasiMasukDariKelas: string | null;
  mutasiMasukDiterimaTanggal: string | null;
  mutasiMasukDiKelas: string | null;
  scholarshipInfo: string | null;
  mutationOutClass: string | null;
  mutationOutToSchool: string | null;
  mutationOutToClass: string | null;
  mutationOutDate: string | null;
  droppedOutDate: string | null;
  droppedOutReason: string | null;
  healthRecords: AlumniHealthRecord[];
}

interface AlumniTranscript {
  id: string;
  academicYear: string;
  semester: string;
  subjectName: string;
  subjectCode: string | null;
  score: number;
  scoreLetter: string | null;
  notes: string | null;
}

interface AlumniAchievement {
  id: string;
  type: string;
  title: string;
  description: string | null;
  level: string;
  ranking: string | null;
  year: string;
  organizer: string | null;
  certificateUrl: string | null;
}

interface AlumniExtracurricular {
  id: string;
  activityName: string;
  role: string | null;
  yearStart: string | null;
  yearEnd: string | null;
  description: string | null;
}

interface AlumniAttendanceSummary {
  id: string;
  academicYear: string;
  semester: string;
  present: number;
  sick: number;
  permission: number;
  absent: number;
  totalDays: number;
}

interface AlumniDocument {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  verificationStatus: string;
  verifiedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  documentType: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface DocumentPickup {
  id: string;
  recipientName: string;
  recipientRelation: string | null;
  pickupDate: Date;
  notes: string | null;
  documentType: {
    id: string;
    name: string;
    code: string;
  } | null;
}

const statusInfo: Record<string, { label: string; color: string }> = {
  active: {
    label: "Aktif",
    color: "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20",
  },
  graduated: {
    label: "Alumni / Lulus",
    color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20",
  },
  transferred: {
    label: "Pindahan",
    color: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20",
  },
  dropped: {
    label: "Keluar",
    color: "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20",
  },
};

const formatDateString = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return format(date, "dd MMMM yyyy", { locale: localeId });
  } catch (e) {
    return dateStr;
  }
};

export default function AlumniDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [alumni, setAlumni] = useState<AlumniDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("documents");

  // Modal states
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptMode, setTranscriptMode] = useState<"add" | "edit">("add");
  const [editingTranscript, setEditingTranscript] = useState<AlumniTranscript | null>(null);

  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState<"add" | "edit">("add");
  const [editingAttendance, setEditingAttendance] = useState<AlumniAttendanceSummary | null>(null);

  const [achievementOpen, setAchievementOpen] = useState(false);
  const [achievementMode, setAchievementMode] = useState<"add" | "edit">("add");
  const [editingAchievement, setEditingAchievement] = useState<AlumniAchievement | null>(null);

  const [ekskulOpen, setEkskulOpen] = useState(false);
  const [ekskulMode, setEkskulMode] = useState<"add" | "edit">("add");
  const [editingEkskul, setEditingEkskul] = useState<AlumniExtracurricular | null>(null);

  const [healthOpen, setHealthOpen] = useState(false);
  const [healthMode, setHealthMode] = useState<"add" | "edit">("add");
  const [editingHealth, setEditingHealth] = useState<AlumniHealthRecord | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Spreadsheet States
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("Ganjil");
  const [columns, setColumns] = useState<Array<{ key: string; label: string; isCustom?: boolean }>>([
    { key: "subjectName", label: "Mata Pelajaran" },
    { key: "subjectCode", label: "Kode MP" },
    { key: "score", label: "Nilai Angka" },
    { key: "scoreLetter", label: "Nilai Huruf" },
    { key: "notes", label: "Catatan" }
  ]);
  const [gridRows, setGridRows] = useState<Array<Record<string, any>>>([]);
  const [savingTranscripts, setSavingTranscripts] = useState(false);

  // Column management states
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");

  // Template management states
  interface SavedTemplate {
    id: string;
    name: string;
    columns: Array<{ key: string; label: string; isCustom?: boolean }>;
    subjects: Array<Record<string, any>>;
  }
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);

  // Load custom templates on mount
  useEffect(() => {
    const stored = localStorage.getItem("sekolahku_custom_templates");
    if (stored) {
      try {
        setSavedTemplates(JSON.parse(stored));
      } catch (e) {
        console.error("Error parsing templates:", e);
      }
    }
  }, []);

  const getAcademicYearOptions = () => {
    const options: string[] = [];
    const baseYear = alumni?.enrolledYear ? parseInt(alumni.enrolledYear) : 2018;
    const currentYear = new Date().getFullYear();
    const startYear = Math.min(baseYear - 1, currentYear - 8);
    const endYear = Math.max(baseYear + 8, currentYear + 2);

    for (let y = startYear; y <= endYear; y++) {
      options.push(`${y}/${y + 1}`);
    }
    return options.reverse();
  };

  // Synchronize database records to columns and gridRows
  useEffect(() => {
    if (!alumni) return;
    
    let activeYear = selectedYear;
    if (!activeYear) {
      if (alumni.transcripts && alumni.transcripts.length > 0) {
        activeYear = alumni.transcripts[alumni.transcripts.length - 1].academicYear;
      } else if (alumni.enrolledYear) {
        activeYear = `${alumni.enrolledYear}/${parseInt(alumni.enrolledYear) + 1}`;
      } else {
        const curYear = new Date().getFullYear();
        activeYear = `${curYear - 1}/${curYear}`;
      }
      setSelectedYear(activeYear);
    }

    const filtered = alumni.transcripts.filter(
      (t) => t.academicYear === activeYear && t.semester === selectedSemester
    );

    if (filtered.length > 0) {
      // 1. Detect any custom columns from the JSON in notes
      const activeCustomCols: Record<string, string> = {};
      const rowsData = filtered.map((t) => {
        let notesText = t.notes || "";
        let customValues: Record<string, string> = {};

        if (t.notes && t.notes.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(t.notes);
            notesText = parsed.notes ?? "";
            customValues = parsed.custom ?? {};
          } catch (e) {
            // Treat as raw notes on error
          }
        }

        Object.keys(customValues).forEach(label => {
          const colKey = `custom_${label.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
          activeCustomCols[colKey] = label;
        });

        return {
          subjectName: t.subjectName,
          subjectCode: t.subjectCode || "",
          score: t.score,
          scoreLetter: t.scoreLetter || "",
          notes: notesText,
          ...customValues
        };
      });

      // 2. Register custom columns that aren't present yet
      setColumns((prev) => {
        const nextCols = [...prev];
        Object.entries(activeCustomCols).forEach(([key, label]) => {
          if (!nextCols.some(c => c.label === label)) {
            nextCols.push({ key, label, isCustom: true });
          }
        });
        return nextCols;
      });

      // 3. Align rows data keys
      const finalRows = rowsData.map((r: any) => {
        const finalRow: Record<string, any> = { ...r };
        Object.entries(activeCustomCols).forEach(([key, label]) => {
          if (r[label] !== undefined) {
            finalRow[key] = r[label];
            delete finalRow[label];
          }
        });
        return finalRow;
      });

      setGridRows(finalRows);
    } else {
      setGridRows([]);
    }
  }, [alumni, selectedYear, selectedSemester]);

  const handleCellChange = (rowIndex: number, field: string, value: string) => {
    const updated = [...gridRows];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };

    if (field === "score") {
      const num = parseFloat(value);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        let letter = "E";
        if (num >= 86) letter = "A";
        else if (num >= 71) letter = "B";
        else if (num >= 56) letter = "C";
        else if (num >= 41) letter = "D";
        updated[rowIndex].scoreLetter = letter;
      } else if (value === "") {
        updated[rowIndex].scoreLetter = "";
      }
    }
    setGridRows(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    const totalCols = columns.length;
    const totalRows = gridRows.length;

    let targetRow = rowIndex;
    let targetCol = colIndex;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        targetRow = Math.max(0, rowIndex - 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        targetRow = Math.min(totalRows - 1, rowIndex + 1);
        break;
      case "ArrowLeft":
        if (e.currentTarget.selectionStart === 0) {
          e.preventDefault();
          targetCol = Math.max(0, colIndex - 1);
        } else {
          return;
        }
        break;
      case "ArrowRight":
        if (e.currentTarget.selectionEnd === e.currentTarget.value.length) {
          e.preventDefault();
          targetCol = Math.min(totalCols - 1, colIndex + 1);
        } else {
          return;
        }
        break;
      case "Enter":
        e.preventDefault();
        targetRow = Math.min(totalRows - 1, rowIndex + 1);
        break;
      default:
        return;
    }

    if (targetRow !== rowIndex || targetCol !== colIndex) {
      const targetId = `cell-${targetRow}-${targetCol}`;
      const el = document.getElementById(targetId) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }
  };

  const loadSDTemplate = () => {
    const template = [
      { subjectName: "Pendidikan Agama & Budi Pekerti", subjectCode: "PABP", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Pendidikan Pancasila & Kewarganegaraan", subjectCode: "PPKn", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Bahasa Indonesia", subjectCode: "BIN", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Matematika", subjectCode: "MAT", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Ilmu Pengetahuan Alam", subjectCode: "IPA", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Ilmu Pengetahuan Sosial", subjectCode: "IPS", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Seni Budaya & Prakarya", subjectCode: "SBdP", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Pendidikan Jasmani, Olahraga, & Kesehatan", subjectCode: "PJOK", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Bahasa Sunda / Daerah", subjectCode: "BSND", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Mulok Keagamaan", subjectCode: "MLK", score: "", scoreLetter: "", notes: "" },
    ];
    
    if (gridRows.length > 0 && gridRows.some(r => r.subjectName !== "" || r.score !== "")) {
      if (!confirm("Muat template akan menggantikan data yang sedang diedit. Lanjutkan?")) return;
    }
    setGridRows(template);
  };

  const handleRemoveRow = (index: number) => {
    const updated = [...gridRows];
    updated.splice(index, 1);
    setGridRows(updated);
  };

  const addCustomColumn = () => {
    const label = newColLabel.trim();
    if (!label) return;
    if (columns.some(col => col.label.toLowerCase() === label.toLowerCase())) {
      alert("Kolom dengan nama tersebut sudah ada!");
      return;
    }
    const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    setColumns([...columns, { key, label, isCustom: true }]);
    setNewColLabel("");
  };

  const removeColumn = (colKey: string) => {
    if (colKey === "subjectName" || colKey === "score") {
      alert("Kolom ini wajib dan tidak dapat dihapus!");
      return;
    }
    if (!confirm("Apakah Anda yakin ingin menghapus kolom ini? Seluruh data pada kolom ini akan hilang.")) return;
    setColumns(columns.filter(col => col.key !== colKey));
    setGridRows(gridRows.map(row => {
      const updated = { ...row };
      delete updated[colKey];
      return updated;
    }));
  };

  const toggleStandardColumn = (key: string, label: string) => {
    if (columns.some(col => col.key === key)) {
      if (!confirm(`Sembunyikan kolom "${label}"?`)) return;
      setColumns(columns.filter(col => col.key !== key));
    } else {
      const defaultOrder = ["subjectName", "subjectCode", "score", "scoreLetter", "notes"];
      const newCols = [...columns, { key, label }];
      newCols.sort((a, b) => {
        const idxA = defaultOrder.indexOf(a.key);
        const idxB = defaultOrder.indexOf(b.key);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
      setColumns(newCols);
    }
  };

  const saveCurrentAsTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) return;
    if (savedTemplates.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      if (!confirm("Template dengan nama tersebut sudah ada. Tindih template?")) return;
    }

    const newTemplate: SavedTemplate = {
      id: Date.now().toString(),
      name,
      columns: columns.map(c => ({ key: c.key, label: c.label, isCustom: c.isCustom })),
      subjects: gridRows.map(row => {
        const item: Record<string, any> = {};
        columns.forEach(col => {
          item[col.key] = row[col.key] || "";
        });
        return item;
      })
    };

    const updated = savedTemplates.filter(t => t.name.toLowerCase() !== name.toLowerCase());
    updated.push(newTemplate);

    localStorage.setItem("sekolahku_custom_templates", JSON.stringify(updated));
    setSavedTemplates(updated);
    setNewTemplateName("");
    alert("Template berhasil disimpan!");
  };

  const loadCustomTemplate = (template: SavedTemplate) => {
    if (gridRows.length > 0 && gridRows.some(r => r.subjectName !== "" || r.score !== "")) {
      if (!confirm(`Muat template "${template.name}" akan menggantikan seluruh lembar kerja saat ini. Lanjutkan?`)) return;
    }
    setColumns(template.columns);
    const newRows = template.subjects.map(subj => {
      const row: Record<string, any> = {};
      template.columns.forEach(col => {
        row[col.key] = subj[col.key] || "";
      });
      return row;
    });
    setGridRows(newRows);
    setTemplatesOpen(false);
  };

  const deleteTemplate = (id: string) => {
    if (!confirm("Hapus template ini?")) return;
    const updated = savedTemplates.filter(t => t.id !== id);
    localStorage.setItem("sekolahku_custom_templates", JSON.stringify(updated));
    setSavedTemplates(updated);
  };

  const handleSaveTranscriptsBulk = async () => {
    if (!selectedYear || !selectedSemester) {
      alert("Tahun Ajaran dan Semester wajib diisi!");
      return;
    }

    const validGrades = gridRows.filter(r => r.subjectName.trim() !== "");
    if (validGrades.length === 0) {
      alert("Belum ada mata pelajaran dan nilai untuk disimpan.");
      return;
    }

    setSavingTranscripts(true);
    try {
      const payload = {
        academicYear: selectedYear,
        semester: selectedSemester,
        grades: validGrades.map(r => {
          const customData: Record<string, string> = {};
          columns.forEach(col => {
            if (col.isCustom) {
              customData[col.label] = String(r[col.key] || "");
            }
          });

          let finalNotes = r.notes || "";
          if (Object.keys(customData).length > 0) {
            finalNotes = JSON.stringify({
              notes: r.notes || "",
              custom: customData
            });
          }

          return {
            subjectName: r.subjectName.trim(),
            subjectCode: r.subjectCode.trim() || null,
            score: parseFloat(r.score as string) || 0,
            scoreLetter: r.scoreLetter.trim() || null,
            notes: finalNotes || null
          };
        })
      };

      await goPost(`/api/alumni/${alumni?.id}/transcripts/bulk`, payload);
      alert("Transkrip nilai berhasil disimpan!");
      fetchAlumni();
    } catch (err: any) {
      console.error(err);
      alert("Gagal menyimpan transkrip nilai: " + (err.message || err));
    } finally {
      setSavingTranscripts(false);
    }
  };

  const fetchAlumni = async () => {
    try {
      const data: any = await goGet(`/api/alumni/${searchParams.get('id')}`);
      if (data) {
        data.documents = data.documents || [];
        data.pickups = data.pickups || [];
        data.transcripts = data.transcripts || [];
        data.achievements = data.achievements || [];
        data.extracurriculars = data.extracurriculars || [];
        data.attendanceSummaries = data.attendanceSummaries || [];
        data.healthRecords = data.healthRecords || [];
      }
      setAlumni(data);
    } catch (error) {
      console.error("Error fetching alumni:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('id')) {
      fetchAlumni();
    }
  }, [searchParams.get('id')]);

  // Handle active tab from query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams.get('tab')]);

  const handleDelete = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus data Buku Induk ini?")) return;

    try {
      await goDelete(`/api/alumni/${searchParams.get('id')}`);
      router.push("/admin/siswa");
    } catch (error) {
      console.error("Error deleting alumni:", error);
    }
  };

  const scoreToLetter = (score: number): string => {
    if (score >= 85) return "A";
    if (score >= 75) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    return "E";
  };

  const handleTranscriptSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!alumni) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const scoreVal = parseFloat(formData.get("score") as string) || 0;
    const letterInput = formData.get("scoreLetter") as string;
    const scoreLetter = letterInput ? letterInput : scoreToLetter(scoreVal);
    const payload = {
      academicYear: formData.get("academicYear"),
      semester: formData.get("semester"),
      subjectName: formData.get("subjectName"),
      subjectCode: (formData.get("subjectCode") as string) || null,
      score: scoreVal,
      scoreLetter: scoreLetter,
      notes: (formData.get("notes") as string) || null,
    };
    try {
      if (transcriptMode === "add") {
        await goPost(`/api/alumni/${alumni.id}/transcripts`, payload);
      } else if (editingTranscript) {
        await goPut(`/api/alumni/transcripts/${editingTranscript.id}`, payload);
      }
      setTranscriptOpen(false);
      fetchAlumni();
    } catch (error) {
      console.error("Error submitting transcript:", error);
      alert("Gagal menyimpan transkrip nilai");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTranscriptDelete = async (transId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus nilai ini?")) return;
    try {
      await goDelete(`/api/alumni/transcripts/${transId}`);
      fetchAlumni();
    } catch (error) {
      console.error("Error deleting transcript:", error);
      alert("Gagal menghapus transkrip nilai");
    }
  };

  const handleAttendanceSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!alumni) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const present = parseInt(formData.get("present") as string) || 0;
    const sick = parseInt(formData.get("sick") as string) || 0;
    const permission = parseInt(formData.get("permission") as string) || 0;
    const absent = parseInt(formData.get("absent") as string) || 0;
    const payload = {
      academicYear: formData.get("academicYear"),
      semester: formData.get("semester"),
      present,
      sick,
      permission,
      absent,
    };
    try {
      if (attendanceMode === "add") {
        await goPost(`/api/alumni/${alumni.id}/attendance`, payload);
      } else if (editingAttendance) {
        await goPut(`/api/alumni/attendance/${editingAttendance.id}`, payload);
      }
      setAttendanceOpen(false);
      fetchAlumni();
    } catch (error) {
      console.error("Error submitting attendance:", error);
      alert("Gagal menyimpan rekap kehadiran");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttendanceDelete = async (attId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus rekap kehadiran ini?")) return;
    try {
      await goDelete(`/api/alumni/attendance/${attId}`);
      fetchAlumni();
    } catch (error) {
      console.error("Error deleting attendance:", error);
      alert("Gagal menghapus rekap kehadiran");
    }
  };

  const handleAchievementSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!alumni) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      type: formData.get("type"),
      title: formData.get("title"),
      description: (formData.get("description") as string) || null,
      level: formData.get("level"),
      ranking: (formData.get("ranking") as string) || null,
      year: formData.get("year"),
      organizer: (formData.get("organizer") as string) || null,
      certificateUrl: (formData.get("certificateUrl") as string) || null,
    };
    try {
      if (achievementMode === "add") {
        await goPost(`/api/alumni/${alumni.id}/achievements`, payload);
      } else if (editingAchievement) {
        await goPut(`/api/alumni/achievements/${editingAchievement.id}`, payload);
      }
      setAchievementOpen(false);
      fetchAlumni();
    } catch (error) {
      console.error("Error submitting achievement:", error);
      alert("Gagal menyimpan prestasi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAchievementDelete = async (achId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus prestasi ini?")) return;
    try {
      await goDelete(`/api/alumni/achievements/${achId}`);
      fetchAlumni();
    } catch (error) {
      console.error("Error deleting achievement:", error);
      alert("Gagal menghapus prestasi");
    }
  };

  const handleEkskulSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!alumni) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      activityName: formData.get("activityName"),
      role: (formData.get("role") as string) || null,
      yearStart: (formData.get("yearStart") as string) || null,
      yearEnd: (formData.get("yearEnd") as string) || null,
      description: (formData.get("description") as string) || null,
    };
    try {
      if (ekskulMode === "add") {
        await goPost(`/api/alumni/${alumni.id}/extracurriculars`, payload);
      } else if (editingEkskul) {
        await goPut(`/api/alumni/extracurriculars/${editingEkskul.id}`, payload);
      }
      setEkskulOpen(false);
      fetchAlumni();
    } catch (error) {
      console.error("Error submitting extracurricular:", error);
      alert("Gagal menyimpan ekstrakurikuler");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEkskulDelete = async (exId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus ekstrakurikuler ini?")) return;
    try {
      await goDelete(`/api/alumni/extracurriculars/${exId}`);
      fetchAlumni();
    } catch (error) {
      console.error("Error deleting extracurricular:", error);
      alert("Gagal menghapus ekstrakurikuler");
    }
  };

  const handleHealthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!alumni) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const weightVal = formData.get("weight") ? parseInt(formData.get("weight") as string) : null;
    const heightVal = formData.get("height") ? parseInt(formData.get("height") as string) : null;
    const payload = {
      year: formData.get("year"),
      weight: weightVal,
      height: heightVal,
      illness: (formData.get("illness") as string) || null,
      abnormality: (formData.get("abnormality") as string) || null,
    };
    try {
      if (healthMode === "add") {
        await goPost(`/api/alumni/${alumni.id}/health-records`, payload);
      } else if (editingHealth) {
        await goPut(`/api/alumni/health-records/${editingHealth.id}`, payload);
      }
      setHealthOpen(false);
      fetchAlumni();
    } catch (error) {
      console.error("Error submitting health record:", error);
      alert("Gagal menyimpan riwayat kesehatan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHealthDelete = async (hrId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan kesehatan ini?")) return;
    try {
      await goDelete(`/api/alumni/health-records/${hrId}`);
      fetchAlumni();
    } catch (error) {
      console.error("Error deleting health record:", error);
      alert("Gagal menghapus catatan kesehatan");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!alumni) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <GraduationCap className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">Data siswa tidak ditemukan</h2>
        <Link href="/admin/siswa">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali ke Buku Induk
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/siswa">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{alumni.fullName}</h1>
              <Badge variant="outline" className={statusInfo[alumni.status]?.color || "bg-secondary text-secondary-foreground"}>
                {statusInfo[alumni.status]?.label || alumni.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {alumni.status === "graduated" 
                ? `Alumni - Lulus Tahun ${alumni.graduationYear}` 
                : alumni.status === "active" 
                ? "Siswa Aktif" 
                : alumni.status === "transferred" 
                ? "Siswa Pindahan (Mutasi)" 
                : "Siswa Keluar / DO"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/siswa/alumni-detail/edit?id=${alumni.id}`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => window.open(`/admin/siswa/buku-induk/print?id=${alumni.id}`, '_blank')}>
            <Printer className="h-4 w-4 mr-1" />
            Cetak Biodata
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`/admin/siswa/buku-induk/print-prestasi?id=${alumni.id}`, '_blank')}>
            <Printer className="h-4 w-4 mr-1" />
            Cetak Prestasi
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Hapus
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Profile Card (Horizontal Top Banner) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <Avatar className="h-20 w-20 shrink-0 border-2 border-slate-100 dark:border-zinc-800">
                  <AvatarImage src={alumni.photo || undefined} />
                  <AvatarFallback className="text-xl font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                    {alumni.fullName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 w-full text-center md:text-left space-y-4">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100">{alumni.fullName}</h3>
                    {alumni.status === "graduated" ? (
                      <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20 font-medium">
                        Alumni (Lulus {alumni.graduationYear})
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20 font-medium">
                        Siswa Aktif
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-zinc-900/50">
                    {alumni.nisn && (
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">NISN / NIS</span>
                        <div className="text-sm font-semibold flex items-center justify-center md:justify-start gap-2 text-slate-700 dark:text-zinc-300">
                          <User className="h-4 w-4 text-slate-400 shrink-0" />
                          {alumni.nisn} {alumni.nis ? `/ ${alumni.nis}` : ""}
                        </div>
                      </div>
                    )}
                    {alumni.finalClass && (
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kelas Akhir</span>
                        <div className="text-sm font-semibold flex items-center justify-center md:justify-start gap-2 text-slate-700 dark:text-zinc-300">
                          <School className="h-4 w-4 text-slate-400 shrink-0" />
                          Kelas {alumni.finalClass}
                        </div>
                      </div>
                    )}
                    {(alumni.currentPhone || alumni.currentEmail) && (
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kontak</span>
                        <div className="text-sm font-semibold flex items-center justify-center md:justify-start gap-2 text-slate-700 dark:text-zinc-300 truncate">
                          <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                          {alumni.currentPhone || alumni.currentEmail}
                        </div>
                      </div>
                    )}
                    {alumni.currentAddress && (
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Alamat</span>
                        <div className="text-sm font-semibold flex items-center justify-center md:justify-start gap-2 text-slate-700 dark:text-zinc-300 truncate">
                          <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                          {alumni.currentAddress}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted p-1 rounded-lg justify-start md:grid md:grid-cols-7 md:h-10">
              <TabsTrigger value="documents" className="flex-1 text-xs md:text-sm">
                Dokumen
              </TabsTrigger>
              <TabsTrigger value="transcripts" className="flex-1 text-xs md:text-sm">
                Nilai
              </TabsTrigger>
              <TabsTrigger value="attendance" className="flex-1 text-xs md:text-sm">
                Absensi
              </TabsTrigger>
              <TabsTrigger value="achievements" className="flex-1 text-xs md:text-sm">
                Prestasi
              </TabsTrigger>
              <TabsTrigger value="health" className="flex-1 text-xs md:text-sm">
                Kesehatan
              </TabsTrigger>
              <TabsTrigger value="pickups" className="flex-1 text-xs md:text-sm">
                Pengambilan
              </TabsTrigger>
              <TabsTrigger value="info" className="flex-1 text-xs md:text-sm">
                Info Profil
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              {/* TAB: DOKUMEN */}
              {activeTab === "documents" && (
                <TabsContent value="documents" className="mt-4">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Dokumen Arsip Digital</CardTitle>
                        <DocumentUpload alumniId={alumni.id} onUploadComplete={fetchAlumni} />
                      </CardHeader>
                      <CardContent>
                        <DocumentGallery documents={alumni.documents} onRefresh={fetchAlumni} />
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              )}

              {/* TAB: TRANSKRIP NILAI */}
              {activeTab === "transcripts" && (
                <TabsContent value="transcripts" className="mt-4">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
                    <Card className="border-slate-200 dark:border-zinc-800 shadow-sm">
                      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800/80">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            Transkrip Nilai (Spreadsheet Grid)
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Pilih Tahun & Semester, gunakan navigasi sel Excel-like (tombol arah / Enter), lalu Simpan Semua.
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)} className="h-9 shadow-sm hover:bg-slate-50">
                            Kelola Template
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setColumnsOpen(true)} className="h-9 shadow-sm hover:bg-slate-50">
                            Kelola Kolom
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                            const emptyRow: Record<string, any> = {};
                            columns.forEach(col => {
                              emptyRow[col.key] = "";
                            });
                            setGridRows([...gridRows, emptyRow]);
                          }} className="h-9 shadow-sm hover:bg-slate-50">
                            <Plus className="h-4 w-4 mr-1" />
                            Tambah Baris
                          </Button>
                          <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 text-white border-0 font-medium shadow-sm" onClick={handleSaveTranscriptsBulk} disabled={savingTranscripts}>
                            {savingTranscripts ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Menyimpan...
                              </>
                            ) : (
                              "Simpan Semua Nilai"
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-4 space-y-4">
                        {/* Selector Controls */}
                        <div className="flex flex-wrap gap-4 items-center bg-slate-50 dark:bg-zinc-950/20 p-3 rounded-lg border border-slate-100 dark:border-zinc-900">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground shrink-0">Tahun Ajaran:</span>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                              <SelectTrigger className="w-[150px] h-9 bg-white dark:bg-zinc-900 border shadow-sm">
                                <SelectValue placeholder="Pilih Tahun" />
                              </SelectTrigger>
                              <SelectContent>
                                {getAcademicYearOptions().map((y) => (
                                  <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground shrink-0">Semester:</span>
                            <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                              <SelectTrigger className="w-[120px] h-9 bg-white dark:bg-zinc-900 border shadow-sm">
                                <SelectValue placeholder="Semester" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Ganjil">Ganjil</SelectItem>
                                <SelectItem value="Genap">Genap</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Spreadsheet Grid */}
                        <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-lg max-h-[500px] overflow-y-auto">
                          <Table className="border-collapse min-w-[800px]">
                            <TableHeader className="bg-slate-50 dark:bg-zinc-900/50 sticky top-0 z-10">
                              <TableRow>
                                {columns.map((col) => (
                                  <TableHead key={col.key} className="border border-slate-200 dark:border-zinc-800 font-bold text-slate-800 dark:text-zinc-200 py-2.5 px-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <span>{col.label}</span>
                                      {col.isCustom && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeColumn(col.key);
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableHead>
                                ))}
                                <TableHead className="w-[60px] border border-slate-200 dark:border-zinc-800 text-center py-2.5 px-3">Hapus</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {gridRows.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={columns.length + 1} className="text-center py-12 text-muted-foreground">
                                    <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-400" />
                                    <p className="text-sm font-semibold">Belum ada mata pelajaran untuk semester ini.</p>
                                    <p className="text-xs text-muted-foreground mt-1">Silakan klik tombol <strong>Kelola Template</strong> atau <strong>Tambah Baris</strong> untuk mulai menginput.</p>
                                  </TableCell>
                                </TableRow>
                              ) : (
                                gridRows.map((row, rIndex) => (
                                  <TableRow key={rIndex} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                                    {columns.map((col, cIndex) => {
                                      const isSubjectName = col.key === "subjectName";
                                      const isScore = col.key === "score";
                                      const isScoreLetter = col.key === "scoreLetter";
                                      
                                      return (
                                        <TableCell key={col.key} className="p-0 border border-slate-200 dark:border-zinc-800">
                                          <input
                                            id={`cell-${rIndex}-${cIndex}`}
                                            type={isScore ? "number" : "text"}
                                            min={isScore ? "0" : undefined}
                                            max={isScore ? "100" : undefined}
                                            step={isScore ? "0.1" : undefined}
                                            value={row[col.key] ?? ""}
                                            onChange={(e) => handleCellChange(rIndex, col.key, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, rIndex, cIndex)}
                                            placeholder={
                                              isSubjectName ? "Nama mata pelajaran..." :
                                              isScore ? "0-100" :
                                              isScoreLetter ? "A, B, C..." :
                                              `Ketik ${col.label}...`
                                            }
                                            className={`w-full h-10 px-3 py-1 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-900 text-sm ${
                                              isSubjectName ? "font-semibold text-slate-800 dark:text-zinc-200" :
                                              isScore ? "text-center font-bold text-blue-600 dark:text-blue-400" :
                                              isScoreLetter ? "text-center font-bold text-slate-700 dark:text-zinc-300" :
                                              "text-slate-600 dark:text-zinc-400"
                                            }`}
                                          />
                                        </TableCell>
                                      );
                                    })}
                                    <TableCell className="p-1 border border-slate-200 dark:border-zinc-800 text-center">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleRemoveRow(rIndex)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              )}

              {/* TAB: KEHADIRAN */}
              {activeTab === "attendance" && (
                <TabsContent value="attendance" className="mt-4">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-primary" />
                          Rekapitulasi Kehadiran
                        </CardTitle>
                        <Button size="sm" onClick={() => {
                          setEditingAttendance(null);
                          setAttendanceMode("add");
                          setAttendanceOpen(true);
                        }}>
                          <Plus className="h-4 w-4 mr-1" />
                          Tambah Rekap
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {alumni.attendanceSummaries.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>Belum ada rekap kehadiran disimpan</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tahun Ajaran</TableHead>
                                  <TableHead>Semester</TableHead>
                                  <TableHead className="text-center">Hadir (H)</TableHead>
                                  <TableHead className="text-center">Sakit (S)</TableHead>
                                  <TableHead className="text-center">Izin (I)</TableHead>
                                  <TableHead className="text-center">Alpha (A)</TableHead>
                                  <TableHead className="text-center font-bold">Total Hari</TableHead>
                                  <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {alumni.attendanceSummaries.map((a) => {
                                  const total = a.present + a.sick + a.permission + a.absent;
                                  return (
                                    <TableRow key={a.id}>
                                      <TableCell className="font-medium">{a.academicYear}</TableCell>
                                      <TableCell>{a.semester}</TableCell>
                                      <TableCell className="text-center text-emerald-600 font-semibold">{a.present}</TableCell>
                                      <TableCell className="text-center text-blue-600">{a.sick}</TableCell>
                                      <TableCell className="text-center text-amber-600">{a.permission}</TableCell>
                                      <TableCell className="text-center text-rose-600">{a.absent}</TableCell>
                                      <TableCell className="text-center font-bold">{total}</TableCell>
                                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => {
                                          setEditingAttendance(a);
                                          setAttendanceMode("edit");
                                          setAttendanceOpen(true);
                                        }}>
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleAttendanceDelete(a.id)}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              )}

              {/* TAB: PRESTASI & EKSKUL */}
              {activeTab === "achievements" && (
                <TabsContent value="achievements" className="mt-4 space-y-6">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }} className="space-y-6">
                    {/* Card Prestasi */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-amber-500" />
                          Prestasi & Penghargaan
                        </CardTitle>
                        <Button size="sm" onClick={() => {
                          setEditingAchievement(null);
                          setAchievementMode("add");
                          setAchievementOpen(true);
                        }}>
                          <Plus className="h-4 w-4 mr-1" />
                          Tambah Prestasi
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {alumni.achievements.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground text-sm">
                            <Trophy className="h-10 w-10 mx-auto mb-2 opacity-40 text-amber-500" />
                            <p>Belum ada data prestasi disimpan</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            {alumni.achievements.map((ach) => (
                              <div key={ach.id} className="p-4 border rounded-lg flex justify-between items-start bg-zinc-50/55 dark:bg-white/5">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm">{ach.title}</span>
                                    <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                                      {ach.level}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {ach.type === "academic" ? "Akademik" : "Non-Akademik"} • {ach.ranking || "Keikutsertaan"} • Tahun {ach.year}
                                  </p>
                                  {ach.organizer && (
                                    <p className="text-xs text-muted-foreground">Penyelenggara: {ach.organizer}</p>
                                  )}
                                  {ach.description && (
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 bg-white dark:bg-zinc-900 p-2 rounded border border-dashed">
                                      {ach.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-1 whitespace-nowrap">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => {
                                    setEditingAchievement(ach);
                                    setAchievementMode("edit");
                                    setAchievementOpen(true);
                                  }}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleAchievementDelete(ach.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Card Ekskul */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Activity className="h-5 w-5 text-emerald-500" />
                          Kegiatan Ekstrakurikuler
                        </CardTitle>
                        <Button size="sm" onClick={() => {
                          setEditingEkskul(null);
                          setEkskulMode("add");
                          setEkskulOpen(true);
                        }}>
                          <Plus className="h-4 w-4 mr-1" />
                          Tambah Ekskul
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {alumni.extracurriculars.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground text-sm">
                            <Activity className="h-10 w-10 mx-auto mb-2 opacity-40 text-emerald-500" />
                            <p>Belum ada data ekstrakurikuler disimpan</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            {alumni.extracurriculars.map((ex) => (
                              <div key={ex.id} className="p-4 border rounded-lg flex justify-between items-start bg-zinc-50/55 dark:bg-white/5">
                                <div className="space-y-1">
                                  <span className="font-semibold text-sm">{ex.activityName}</span>
                                  <p className="text-xs text-muted-foreground">
                                    Peran: {ex.role || "-"} • Periode: {ex.yearStart || "?"} - {ex.yearEnd || "Sekarang"}
                                  </p>
                                  {ex.description && (
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 bg-white dark:bg-zinc-900 p-2 rounded border border-dashed">
                                      {ex.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-1 whitespace-nowrap">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => {
                                    setEditingEkskul(ex);
                                    setEkskulMode("edit");
                                    setEkskulOpen(true);
                                  }}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleEkskulDelete(ex.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              )}

              {/* TAB: RIWAYAT PENGAMBILAN */}
              {activeTab === "pickups" && (
                <TabsContent value="pickups" className="mt-4">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Riwayat Serah Terima Dokumen Fisik</CardTitle>
                        {alumni.status === "graduated" && (
                          <PickupForm alumniId={alumni.id} onPickupComplete={fetchAlumni} />
                        )}
                      </CardHeader>
                      <CardContent>
                        {alumni.pickups.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>Belum ada riwayat serah terima dokumen</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {alumni.pickups.map((pickup) => (
                              <div
                                key={pickup.id}
                                className="flex items-start gap-4 p-3 border rounded-lg"
                              >
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Calendar className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">
                                    {pickup.documentType?.name || "Dokumen"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Diambil oleh: <span className="font-semibold">{pickup.recipientName}</span>
                                    {pickup.recipientRelation && ` (${pickup.recipientRelation})`}
                                  </p>
                                  {pickup.notes && <p className="text-xs text-muted-foreground mt-1">Catatan: {pickup.notes}</p>}
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    Waktu: {format(new Date(pickup.pickupDate), "dd MMMM yyyy HH:mm", {
                                      locale: localeId,
                                    })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              )}

              {/* TAB: KESEHATAN BERKALA */}
              {activeTab === "health" && (
                <TabsContent value="health" className="mt-4">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Heart className="h-5 w-5 text-rose-500 animate-pulse" />
                          Riwayat Kesehatan & Perkembangan Jasmani
                        </CardTitle>
                        <Button size="sm" onClick={() => {
                          setEditingHealth(null);
                          setHealthMode("add");
                          setHealthOpen(true);
                        }}>
                          <Plus className="h-4 w-4 mr-1" />
                          Tambah Rekam Medis
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {(!alumni.healthRecords || alumni.healthRecords.length === 0) ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Heart className="h-12 w-12 mx-auto mb-2 opacity-50 text-rose-500" />
                            <p>Belum ada catatan kesehatan tahunan disimpan</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tingkat / Kelas</TableHead>
                                  <TableHead>Berat Badan (kg)</TableHead>
                                  <TableHead>Tinggi Badan (cm)</TableHead>
                                  <TableHead>Penyakit Diderita</TableHead>
                                  <TableHead>Kelainan Jasmani</TableHead>
                                  <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {alumni.healthRecords.map((hr) => (
                                  <TableRow key={hr.id}>
                                    <TableCell className="font-semibold">{hr.year}</TableCell>
                                    <TableCell>{hr.weight ? `${hr.weight} kg` : "-"}</TableCell>
                                    <TableCell>{hr.height ? `${hr.height} cm` : "-"}</TableCell>
                                    <TableCell className="max-w-xs truncate">{hr.illness || "-"}</TableCell>
                                    <TableCell className="max-w-xs truncate">{hr.abnormality || "-"}</TableCell>
                                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => {
                                        setEditingHealth(hr);
                                        setHealthMode("edit");
                                        setHealthOpen(true);
                                      }}>
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleHealthDelete(hr.id)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              )}

              {/* TAB: INFO LENGKAP PROFIL (BUKU INDUK) */}
              {activeTab === "info" && (
                <TabsContent value="info" className="mt-4">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Informasi Lengkap Buku Induk</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Bagian 1: Identitas */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm text-primary flex items-center gap-1 border-b pb-1">
                            <User className="h-4 w-4" />
                            Identitas Diri
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Nama Lengkap</p>
                              <p className="font-medium">{alumni.fullName}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Nama Panggilan</p>
                              <p className="font-medium">{alumni.nickname || "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Jenis Kelamin</p>
                              <p className="font-medium">
                                {alumni.gender === "L" ? "Laki-laki" : alumni.gender === "P" ? "Perempuan" : "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">NISN</p>
                              <p className="font-medium font-mono">{alumni.nisn || "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">NIS (Nomor Induk)</p>
                              <p className="font-medium font-mono">{alumni.nis || "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">NIK (Nomor Induk Kependudukan)</p>
                              <p className="font-medium font-mono">{alumni.nik || "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Tempat, Tanggal Lahir</p>
                              <p className="font-medium">
                                {alumni.birthPlace || "-"}
                                {alumni.birthDate && `, ${formatDateString(alumni.birthDate)}`}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Agama</p>
                              <p className="font-medium">{alumni.religion || "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Kewarganegaraan</p>
                              <p className="font-medium">{alumni.citizenship || "WNI"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Bahasa Sehari-hari</p>
                              <p className="font-medium">{alumni.dailyLanguage || "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Bertempat Tinggal Pada</p>
                              <p className="font-medium">{alumni.livingWith || "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Tahun Masuk / Terdaftar</p>
                              <p className="font-medium font-mono">{alumni.enrolledYear || "-"}</p>
                            </div>
                            <div className="md:col-span-3">
                              <p className="text-xs text-muted-foreground">Alamat Tempat Tinggal</p>
                              <p className="font-medium">{alumni.address || "-"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Bagian 2: Riwayat Asal Masuk (TK / Mutasi) */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm text-primary flex items-center gap-1 border-b pb-1">
                            <School className="h-4 w-4" />
                            Riwayat Asal Masuk / Penerimaan
                          </h4>
                          {alumni.mutasiMasukAsalSekolah || alumni.mutasiMasukDariKelas ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-amber-50/30 dark:bg-amber-950/10 p-3 rounded-lg border border-amber-100/50 dark:border-amber-900/30">
                              <div className="md:col-span-2">
                                <p className="text-xs text-muted-foreground">Metode Masuk</p>
                                <p className="font-semibold text-amber-600 dark:text-amber-400">Pindahan (Mutasi Masuk)</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Asal Sekolah</p>
                                <p className="font-medium">{alumni.mutasiMasukAsalSekolah || "-"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Dari Kelas</p>
                                <p className="font-medium">{alumni.mutasiMasukDariKelas || "-"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Diterima Tanggal</p>
                                <p className="font-medium">{formatDateString(alumni.mutasiMasukDiterimaTanggal)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Diterima di Kelas</p>
                                <p className="font-medium">{alumni.mutasiMasukDiKelas || "-"}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50/50 dark:bg-zinc-900/30 p-3 rounded-lg border">
                              <div className="md:col-span-2">
                                <p className="text-xs text-muted-foreground">Metode Masuk</p>
                                <p className="font-semibold text-emerald-600 dark:text-emerald-400">Siswa Baru Kelas I</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">TK Asal</p>
                                <p className="font-medium">{alumni.previousSchool || "-"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Alamat TK Asal</p>
                                <p className="font-medium">{alumni.previousSchoolAddress || "-"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Nomor STTB TK</p>
                                <p className="font-medium font-mono">{alumni.previousSchoolCertNo || "-"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Tanggal STTB TK</p>
                                <p className="font-medium">{formatDateString(alumni.previousSchoolCertDate)}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bagian 3: Riwayat Meninggalkan Sekolah */}
                        {alumni.status !== "active" && (
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm text-primary flex items-center gap-1 border-b pb-1">
                              <GraduationCap className="h-4 w-4" />
                              Riwayat Keluar / Meninggalkan Sekolah
                            </h4>
                            {alumni.status === "graduated" && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-blue-50/30 dark:bg-blue-950/10 p-3 rounded-lg border border-blue-100/50 dark:border-blue-900/30 animate-in fade-in duration-200">
                                <div>
                                  <p className="text-xs text-muted-foreground">Tahun Lulus</p>
                                  <p className="font-medium font-semibold text-blue-600 dark:text-blue-400">{alumni.graduationYear}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Tanggal Kelulusan</p>
                                  <p className="font-medium">{formatDateString(alumni.graduationDate ? alumni.graduationDate.toString() : null)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Melanjutkan Ke Sekolah (SMP/MTs)</p>
                                  <p className="font-medium">{alumni.nextSchool || "-"}</p>
                                </div>
                              </div>
                            )}
                            {alumni.status === "transferred" && (
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm bg-amber-50/30 dark:bg-amber-950/10 p-3 rounded-lg border border-amber-100/50 dark:border-amber-900/30 animate-in fade-in duration-200">
                                <div>
                                  <p className="text-xs text-muted-foreground">Tanggal Pindah</p>
                                  <p className="font-medium">{formatDateString(alumni.mutationOutDate)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Dari Kelas</p>
                                  <p className="font-medium">{alumni.mutationOutClass || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Sekolah Tujuan</p>
                                  <p className="font-medium">{alumni.mutationOutToSchool || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Ke Kelas</p>
                                  <p className="font-medium">{alumni.mutationOutToClass || "-"}</p>
                                </div>
                              </div>
                            )}
                            {alumni.status === "dropped" && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-rose-50/30 dark:bg-rose-950/10 p-3 rounded-lg border border-rose-100/50 dark:border-rose-900/30 animate-in fade-in duration-200">
                                <div>
                                  <p className="text-xs text-muted-foreground">Tanggal Keluar (DO)</p>
                                  <p className="font-medium font-semibold text-rose-600 dark:text-rose-400">{formatDateString(alumni.droppedOutDate)}</p>
                                </div>
                                <div className="md:col-span-2">
                                  <p className="text-xs text-muted-foreground">Alasan Keluar / Putus Sekolah</p>
                                  <p className="font-medium">{alumni.droppedOutReason || "-"}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bagian 4: Data Orang Tua & Wali */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm text-primary flex items-center gap-1 border-b pb-1">
                            <Users className="h-4 w-4" />
                            Data Orang Tua & Wali
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            {/* Ayah */}
                            <div className="space-y-2 p-3 border rounded-lg bg-zinc-50/40 dark:bg-white/5">
                              <p className="font-bold text-xs text-muted-foreground uppercase border-b pb-0.5">Ayah Kandung</p>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Nama Lengkap</p>
                                <p className="font-medium">{alumni.fatherName || "-"}</p>
                                <p className="text-xs text-muted-foreground mt-1">NIK</p>
                                <p className="font-medium font-mono">{alumni.fatherNik || "-"}</p>
                                <p className="text-xs text-muted-foreground mt-1">Pendidikan</p>
                                <p className="font-medium">{alumni.fatherEducation || "-"}</p>
                                <p className="text-xs text-muted-foreground mt-1">Pekerjaan</p>
                                <p className="font-medium">{alumni.fatherJob || "-"}</p>
                              </div>
                            </div>

                            {/* Ibu */}
                            <div className="space-y-2 p-3 border rounded-lg bg-zinc-50/40 dark:bg-white/5">
                              <p className="font-bold text-xs text-muted-foreground uppercase border-b pb-0.5">Ibu Kandung</p>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Nama Lengkap</p>
                                <p className="font-medium">{alumni.motherName || "-"}</p>
                                <p className="text-xs text-muted-foreground mt-1">NIK</p>
                                <p className="font-medium font-mono">{alumni.motherNik || "-"}</p>
                                <p className="text-xs text-muted-foreground mt-1">Pendidikan</p>
                                <p className="font-medium">{alumni.motherEducation || "-"}</p>
                                <p className="text-xs text-muted-foreground mt-1">Pekerjaan</p>
                                <p className="font-medium">{alumni.motherJob || "-"}</p>
                              </div>
                            </div>

                            {/* Wali */}
                            {(alumni.guardianName || alumni.guardianPhone) && (
                              <div className="md:col-span-2 space-y-2 p-3 border rounded-lg bg-zinc-50/40 dark:bg-white/5">
                                <p className="font-bold text-xs text-muted-foreground uppercase border-b pb-0.5">Wali Siswa</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Nama Lengkap</p>
                                    <p className="font-medium">{alumni.guardianName || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Hubungan Keluarga</p>
                                    <p className="font-medium">{alumni.guardianRelation || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">NIK Wali</p>
                                    <p className="font-medium font-mono">{alumni.guardianNik || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Pendidikan Wali</p>
                                    <p className="font-medium">{alumni.guardianEducation || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Pekerjaan Wali</p>
                                    <p className="font-medium">{alumni.guardianJob || "-"}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Telepon Wali</p>
                                    <p className="font-medium font-mono">{alumni.guardianPhone || "-"}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Kontak Utama */}
                            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Kontak Utama Orang Tua / Penanggung Jawab</p>
                                <p className="font-medium">{alumni.parentName || "-"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Telepon Kontak Utama</p>
                                <p className="font-medium font-mono">{alumni.parentPhone || "-"}</p>
                              </div>
                            </div>

                            {/* Detail Jumlah Saudara & Urutan */}
                            <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t pt-4 bg-slate-50/50 dark:bg-zinc-900/30 p-3 rounded-lg border">
                              <div>
                                <p className="text-xs text-muted-foreground">Anak Ke</p>
                                <p className="font-medium">{alumni.childOrder || "-"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Saudara Kandung</p>
                                <p className="font-medium">{alumni.siblingKandung ?? 0}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Saudara Tiri</p>
                                <p className="font-medium">{alumni.siblingTiri ?? 0}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Saudara Angkat</p>
                                <p className="font-medium">{alumni.siblingAngkat ?? 0}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bagian 5: Riwayat Fisik & Kesehatan (Umum) */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm text-primary flex items-center gap-1 border-b pb-1">
                            <Heart className="h-4 w-4" />
                            Fisik & Kesehatan Umum
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Tinggi Badan Masuk</p>
                              <p className="font-medium">{alumni.height ? `${alumni.height} cm` : "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Berat Badan Masuk</p>
                              <p className="font-medium">{alumni.weight ? `${alumni.weight} kg` : "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Golongan Darah</p>
                              <p className="font-medium">
                                <Badge variant="outline">{alumni.bloodType || "-"}</Badge>
                              </p>
                            </div>
                            <div className="md:col-span-3">
                              <p className="text-xs text-muted-foreground">Catatan Medis / Riwayat Penyakit</p>
                              <p className="font-medium text-xs bg-muted p-2 rounded">{alumni.medicalNotes || "-"}</p>
                            </div>
                            <div className="md:col-span-3">
                              <p className="text-xs text-muted-foreground">Kebutuhan Khusus</p>
                              <p className="font-medium text-xs bg-muted p-2 rounded">{alumni.specialNeeds || "-"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Bagian 6: Beasiswa & Pasca Lulus */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm text-primary flex items-center gap-1 border-b pb-1">
                            <Award className="h-4 w-4" />
                            Beasiswa & Riwayat Pasca Kelulusan
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="md:col-span-2">
                              <p className="text-xs text-muted-foreground">Informasi Penerimaan Beasiswa</p>
                              <p className="font-medium text-xs bg-muted p-2 rounded">{alumni.scholarshipInfo || "-"}</p>
                            </div>
                            {alumni.status === "graduated" && (
                              <>
                                <div>
                                  <p className="text-xs text-muted-foreground">Rata-rata Nilai Ujian Akhir (Rapor/Kelulusan)</p>
                                  <p className="font-medium font-semibold">{alumni.finalGradeAvg !== null ? alumni.finalGradeAvg.toFixed(2) : "-"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Pendidikan Terakhir Siswa</p>
                                  <p className="font-medium">{alumni.lastEducationLevel || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Pekerjaan / Jabatan Saat Ini</p>
                                  <p className="font-medium">{alumni.currentOccupation || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Nama Institusi / Perusahaan</p>
                                  <p className="font-medium">{alumni.currentInstitution || "-"}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Bagian 7: Catatan Internal */}
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Catatan Tambahan Buku Induk</p>
                          <div className="text-sm p-3 border bg-zinc-50/50 rounded-lg dark:bg-zinc-900/40">
                            {alumni.notes || "Tidak ada catatan khusus."}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              )}
            </AnimatePresence>
          </Tabs>
        </motion.div>
      </div>

      {/* DIALOG: KELOLA KOLOM */}
      <Dialog open={columnsOpen} onOpenChange={setColumnsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kelola Kolom Spreadsheet</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            {/* Standard Columns Toggle */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kolom Standar</h4>
              <div className="space-y-2">
                {[
                  { key: "subjectCode", label: "Kode MP" },
                  { key: "scoreLetter", label: "Nilai Huruf" },
                  { key: "notes", label: "Catatan" }
                ].map(col => {
                  const isActive = columns.some(c => c.key === col.key);
                  return (
                    <label key={col.key} className="flex items-center gap-2 text-sm font-medium cursor-pointer p-2 rounded hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleStandardColumn(col.key, col.label)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Tampilkan Kolom "{col.label}"</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Custom Columns List */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kolom Kustom</h4>
              <div className="space-y-2">
                {columns.filter(col => col.isCustom).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Belum ada kolom kustom yang ditambahkan.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {columns.filter(col => col.isCustom).map(col => (
                      <Badge key={col.key} variant="secondary" className="flex items-center gap-1.5 py-1 pl-2.5 pr-1.5 font-medium text-xs">
                        {col.label}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                          onClick={() => removeColumn(col.key)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Custom Column Input */}
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Nama kolom (misal: KKM, Bobot)"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  className="h-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomColumn();
                    }
                  }}
                />
                <Button size="sm" onClick={addCustomColumn} className="h-9 shrink-0">
                  Tambah
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: KELOLA TEMPLATE */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kelola Template Mapel</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            {/* Save Current as Template */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Simpan Layout & Mapel Saat Ini</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Nama template (misal: KTSP Kelas 4)"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="h-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveCurrentAsTemplate();
                    }
                  }}
                />
                <Button size="sm" onClick={saveCurrentAsTemplate} className="h-9 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                  Simpan
                </Button>
              </div>
            </div>

            {/* Template List */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Daftar Template Tersimpan</h4>
              {savedTemplates.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">Belum ada template kustom disimpan di browser ini.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {savedTemplates.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-950/20 hover:bg-slate-50 dark:hover:bg-zinc-950/40 transition-colors">
                      <div className="space-y-0.5 cursor-pointer flex-1" onClick={() => loadCustomTemplate(t)}>
                        <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{t.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {t.subjects.length} Mapel • {t.columns.length} Kolom
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteTemplate(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG MODAL: TRANSKRIP NILAI */}
      <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {transcriptMode === "add" ? "Tambah Transkrip Nilai" : "Ubah Transkrip Nilai"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTranscriptSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="academicYear">Tahun Ajaran *</Label>
                <Input
                  id="academicYear"
                  name="academicYear"
                  placeholder="Contoh: 2025/2026"
                  defaultValue={editingTranscript?.academicYear || ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="semester">Semester *</Label>
                <Select name="semester" defaultValue={editingTranscript?.semester || "Ganjil"}>
                  <SelectTrigger id="semester">
                    <SelectValue placeholder="Pilih Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ganjil">Ganjil</SelectItem>
                    <SelectItem value="Genap">Genap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subjectName">Nama Mata Pelajaran *</Label>
              <Input
                id="subjectName"
                name="subjectName"
                placeholder="Contoh: Matematika"
                defaultValue={editingTranscript?.subjectName || ""}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subjectCode">Kode MP (Opsional)</Label>
                <Input
                  id="subjectCode"
                  name="subjectCode"
                  placeholder="Contoh: MTK10"
                  defaultValue={editingTranscript?.subjectCode || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="score">Nilai Angka *</Label>
                <Input
                  id="score"
                  name="score"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0 - 100"
                  defaultValue={editingTranscript?.score ?? ""}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scoreLetter">Nilai Huruf (Opsional - otomatis dikonversi jika kosong)</Label>
              <Input
                id="scoreLetter"
                name="scoreLetter"
                placeholder="A, B, C, D, E"
                defaultValue={editingTranscript?.scoreLetter || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan (Opsional)</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Catatan nilai..."
                defaultValue={editingTranscript?.notes || ""}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setTranscriptOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG MODAL: REKAP ABSENSI */}
      <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {attendanceMode === "add" ? "Tambah Rekap Kehadiran" : "Ubah Rekap Kehadiran"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAttendanceSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="attAcademicYear">Tahun Ajaran *</Label>
                <Input
                  id="attAcademicYear"
                  name="academicYear"
                  placeholder="Contoh: 2025/2026"
                  defaultValue={editingAttendance?.academicYear || ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attSemester">Semester *</Label>
                <Select name="semester" defaultValue={editingAttendance?.semester || "Ganjil"}>
                  <SelectTrigger id="attSemester">
                    <SelectValue placeholder="Pilih Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ganjil">Ganjil</SelectItem>
                    <SelectItem value="Genap">Genap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="present">Hadir (Hari) *</Label>
                <Input
                  id="present"
                  name="present"
                  type="number"
                  min="0"
                  defaultValue={editingAttendance?.present ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sick">Sakit (Hari)</Label>
                <Input
                  id="sick"
                  name="sick"
                  type="number"
                  min="0"
                  defaultValue={editingAttendance?.sick ?? 0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="permission">Izin (Hari)</Label>
                <Input
                  id="permission"
                  name="permission"
                  type="number"
                  min="0"
                  defaultValue={editingAttendance?.permission ?? 0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="absent">Alpha (Hari)</Label>
                <Input
                  id="absent"
                  name="absent"
                  type="number"
                  min="0"
                  defaultValue={editingAttendance?.absent ?? 0}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAttendanceOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG MODAL: PRESTASI */}
      <Dialog open={achievementOpen} onOpenChange={setAchievementOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {achievementMode === "add" ? "Tambah Prestasi" : "Ubah Prestasi"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAchievementSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Jenis Prestasi *</Label>
              <Select name="type" defaultValue={editingAchievement?.type || "academic"}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Pilih Jenis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic">Akademik</SelectItem>
                  <SelectItem value="non_academic">Non-Akademik</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Nama Prestasi / Penghargaan *</Label>
              <Input
                id="title"
                name="title"
                placeholder="Contoh: Juara 1 Olimpiade Fisika"
                defaultValue={editingAchievement?.title || ""}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="level">Tingkat *</Label>
                <Select name="level" defaultValue={editingAchievement?.level || "school"}>
                  <SelectTrigger id="level">
                    <SelectValue placeholder="Pilih Tingkat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">Sekolah</SelectItem>
                    <SelectItem value="district">Kecamatan/Kabupaten</SelectItem>
                    <SelectItem value="province">Provinsi</SelectItem>
                    <SelectItem value="national">Nasional</SelectItem>
                    <SelectItem value="international">Internasional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Tahun Perolehan *</Label>
                <Input
                  id="year"
                  name="year"
                  placeholder="Contoh: 2025"
                  defaultValue={editingAchievement?.year || ""}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ranking">Peringkat / Juara Ke-</Label>
                <Input
                  id="ranking"
                  name="ranking"
                  placeholder="Contoh: Juara 1 / Harapan 2"
                  defaultValue={editingAchievement?.ranking || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organizer">Penyelenggara</Label>
                <Input
                  id="organizer"
                  name="organizer"
                  placeholder="Contoh: Dinas Pendidikan"
                  defaultValue={editingAchievement?.organizer || ""}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="certificateUrl">URL Sertifikat (Opsional)</Label>
              <Input
                id="certificateUrl"
                name="certificateUrl"
                placeholder="https://..."
                defaultValue={editingAchievement?.certificateUrl || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="achDescription">Deskripsi / Detail Penghargaan</Label>
              <Textarea
                id="achDescription"
                name="description"
                placeholder="Deskripsi singkat..."
                defaultValue={editingAchievement?.description || ""}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAchievementOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG MODAL: EKSTRAKURIKULER */}
      <Dialog open={ekskulOpen} onOpenChange={setEkskulOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {ekskulMode === "add" ? "Tambah Ekstrakurikuler" : "Ubah Ekstrakurikuler"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEkskulSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activityName">Nama Kegiatan / Ekskul *</Label>
              <Input
                id="activityName"
                name="activityName"
                placeholder="Contoh: Pramuka / Paskibra"
                defaultValue={editingEkskul?.activityName || ""}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Peran / Jabatan</Label>
              <Input
                id="role"
                name="role"
                placeholder="Contoh: Ketua / Anggota Aktif"
                defaultValue={editingEkskul?.role || ""}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="yearStart">Tahun Mulai</Label>
                <Input
                  id="yearStart"
                  name="yearStart"
                  placeholder="Contoh: 2023"
                  defaultValue={editingEkskul?.yearStart || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearEnd">Tahun Selesai</Label>
                <Input
                  id="yearEnd"
                  name="yearEnd"
                  placeholder="Contoh: 2025"
                  defaultValue={editingEkskul?.yearEnd || ""}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exDescription">Keterangan / Deskripsi Kegiatan</Label>
              <Textarea
                id="exDescription"
                name="description"
                placeholder="Deskripsi singkat..."
                defaultValue={editingEkskul?.description || ""}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEkskulOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG MODAL: RIWAYAT KESEHATAN BERKALA */}
      <Dialog open={healthOpen} onOpenChange={setHealthOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {healthMode === "add" ? "Tambah Rekam Medis Tahunan" : "Ubah Rekam Medis Tahunan"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleHealthSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="healthYear">Tingkat Kelas / Tahun *</Label>
              <Select name="year" defaultValue={editingHealth?.year || "Kelas I"}>
                <SelectTrigger id="healthYear">
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kelas I">Kelas I</SelectItem>
                  <SelectItem value="Kelas II">Kelas II</SelectItem>
                  <SelectItem value="Kelas III">Kelas III</SelectItem>
                  <SelectItem value="Kelas IV">Kelas IV</SelectItem>
                  <SelectItem value="Kelas V">Kelas V</SelectItem>
                  <SelectItem value="Kelas VI">Kelas VI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="healthWeight">Berat Badan (kg)</Label>
                <Input
                  id="healthWeight"
                  name="weight"
                  type="number"
                  placeholder="Contoh: 25"
                  defaultValue={editingHealth?.weight ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="healthHeight">Tinggi Badan (cm)</Label>
                <Input
                  id="healthHeight"
                  name="height"
                  type="number"
                  placeholder="Contoh: 120"
                  defaultValue={editingHealth?.height ?? ""}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="healthIllness">Penyakit Diderita (Opsional)</Label>
              <Input
                id="healthIllness"
                name="illness"
                placeholder="Contoh: Campak, Cacingan, dll."
                defaultValue={editingHealth?.illness || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="healthAbnormality">Kelainan Jasmani (Opsional)</Label>
              <Input
                id="healthAbnormality"
                name="abnormality"
                placeholder="Contoh: - (jika tidak ada)"
                defaultValue={editingHealth?.abnormality || ""}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setHealthOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
