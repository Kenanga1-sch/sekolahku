"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import type {
  AlumniDetail,
  AlumniTranscript,
  AlumniAttendanceSummary,
  AlumniAchievement,
  AlumniExtracurricular,
  AlumniHealthRecord,
} from "./types-alumni";

export interface ColumnDef {
  key: string;
  label: string;
  isCustom?: boolean;
}

export interface SavedTemplate {
  id: string;
  name: string;
  columns: ColumnDef[];
  subjects: Record<string, any>[];
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "subjectName", label: "Mata Pelajaran" },
  { key: "subjectCode", label: "Kode MP" },
  { key: "score", label: "Nilai Angka" },
  { key: "scoreLetter", label: "Nilai Huruf" },
  { key: "notes", label: "Catatan" },
];

export function scoreToLetter(score: number): string {
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "E";
}

export function getAcademicYearOptions(enrolledYear?: string): string[] {
  const options: string[] = [];
  const baseYear = enrolledYear ? parseInt(enrolledYear) : 2018;
  const currentYear = new Date().getFullYear();
  const startYear = Math.min(baseYear - 1, currentYear - 8);
  const endYear = Math.max(baseYear + 8, currentYear + 2);

  for (let y = startYear; y <= endYear; y++) {
    options.push(`${y}/${y + 1}`);
  }
  return options.reverse();
}

export function useAlumniDetail() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [alumni, setAlumni] = useState<AlumniDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("documents");
  const [submitting, setSubmitting] = useState(false);

  // --- Spreadsheet state ---
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("Ganjil");
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [gridRows, setGridRows] = useState<Record<string, any>[]>([]);
  const [savingTranscripts, setSavingTranscripts] = useState(false);

  // Column management
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");

  // Template management
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);

  // --- Dialog states ---
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

  // --- Fetch ---
  const fetchAlumni = useCallback(async () => {
    try {
      const resData: any = await goGet(`/api/alumni/${searchParams.get("id")}`);
      const data = resData?.data || resData;
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
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("id")) {
      fetchAlumni();
    }
  }, [searchParams.get("id"), fetchAlumni]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams.get("tab")]);

  // --- Load custom templates on mount ---
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

  // --- Sync database records to columns and gridRows ---
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
      const activeCustomCols: Record<string, string> = {};
      const rowsData = filtered.map((t) => {
        let notesText = t.notes || "";
        let customValues: Record<string, string> = {};

        if (t.notes && t.notes.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(t.notes);
            notesText = parsed.notes ?? "";
            customValues = parsed.custom ?? {};
          } catch {
            // Treat as raw notes on error
          }
        }

        Object.keys(customValues).forEach((label) => {
          const colKey = `custom_${label.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
          activeCustomCols[colKey] = label;
        });

        return {
          subjectName: t.subjectName,
          subjectCode: t.subjectCode || "",
          score: t.score,
          scoreLetter: t.scoreLetter || "",
          notes: notesText,
          ...customValues,
        };
      });

      setColumns((prev) => {
        const nextCols = [...prev];
        Object.entries(activeCustomCols).forEach(([key, label]) => {
          if (!nextCols.some((c) => c.label === label)) {
            nextCols.push({ key, label, isCustom: true });
          }
        });
        return nextCols;
      });

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

  // --- Delete alumni ---
  const handleDelete = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus data Buku Induk ini?")) return;
    try {
      await goDelete(`/api/alumni/${searchParams.get("id")}`);
      router.push("/admin/siswa");
    } catch (error) {
      console.error("Error deleting alumni:", error);
    }
  };

  // --- Spreadsheet helpers ---
  const handleCellChange = (rowIndex: number, field: string, value: string) => {
    const updated = [...gridRows];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };

    if (field === "score") {
      const num = parseFloat(value);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        updated[rowIndex].scoreLetter = scoreToLetter(num);
      } else if (value === "") {
        updated[rowIndex].scoreLetter = "";
      }
    }
    setGridRows(updated);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) => {
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
        } else return;
        break;
      case "ArrowRight":
        if (e.currentTarget.selectionEnd === e.currentTarget.value.length) {
          e.preventDefault();
          targetCol = Math.min(totalCols - 1, colIndex + 1);
        } else return;
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

  const handleRemoveRow = (index: number) => {
    const updated = [...gridRows];
    updated.splice(index, 1);
    setGridRows(updated);
  };

  const addRow = () => {
    const emptyRow: Record<string, any> = {};
    columns.forEach((col) => {
      emptyRow[col.key] = "";
    });
    setGridRows([...gridRows, emptyRow]);
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

    if (gridRows.length > 0 && gridRows.some((r) => r.subjectName !== "" || r.score !== "")) {
      if (!confirm("Muat template akan menggantikan data yang sedang diedit. Lanjutkan?")) return;
    }
    setGridRows(template);
  };

  // --- Custom column management ---
  const addCustomColumn = () => {
    const label = newColLabel.trim();
    if (!label) return;
    if (columns.some((col) => col.label.toLowerCase() === label.toLowerCase())) {
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
    setColumns(columns.filter((col) => col.key !== colKey));
    setGridRows(
      gridRows.map((row) => {
        const updated = { ...row };
        delete updated[colKey];
        return updated;
      })
    );
  };

  const toggleStandardColumn = (key: string, label: string) => {
    if (columns.some((col) => col.key === key)) {
      if (!confirm(`Sembunyikan kolom "${label}"?`)) return;
      setColumns(columns.filter((col) => col.key !== key));
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

  // --- Template management ---
  const saveCurrentAsTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) return;
    if (savedTemplates.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      if (!confirm("Template dengan nama tersebut sudah ada. Tindih template?")) return;
    }

    const newTemplate: SavedTemplate = {
      id: Date.now().toString(),
      name,
      columns: columns.map((c) => ({ key: c.key, label: c.label, isCustom: c.isCustom })),
      subjects: gridRows.map((row) => {
        const item: Record<string, any> = {};
        columns.forEach((col) => {
          item[col.key] = row[col.key] || "";
        });
        return item;
      }),
    };

    const updated = savedTemplates.filter((t) => t.name.toLowerCase() !== name.toLowerCase());
    updated.push(newTemplate);
    localStorage.setItem("sekolahku_custom_templates", JSON.stringify(updated));
    setSavedTemplates(updated);
    setNewTemplateName("");
    alert("Template berhasil disimpan!");
  };

  const loadCustomTemplate = (template: SavedTemplate) => {
    if (gridRows.length > 0 && gridRows.some((r) => r.subjectName !== "" || r.score !== "")) {
      if (!confirm(`Muat template "${template.name}" akan menggantikan seluruh lembar kerja saat ini. Lanjutkan?`)) return;
    }
    setColumns(template.columns);
    const newRows = template.subjects.map((subj) => {
      const row: Record<string, any> = {};
      template.columns.forEach((col) => {
        row[col.key] = subj[col.key] || "";
      });
      return row;
    });
    setGridRows(newRows);
    setTemplatesOpen(false);
  };

  const deleteTemplate = (id: string) => {
    if (!confirm("Hapus template ini?")) return;
    const updated = savedTemplates.filter((t) => t.id !== id);
    localStorage.setItem("sekolahku_custom_templates", JSON.stringify(updated));
    setSavedTemplates(updated);
  };

  // --- Save transcripts bulk ---
  const handleSaveTranscriptsBulk = async () => {
    if (!selectedYear || !selectedSemester) {
      alert("Tahun Ajaran dan Semester wajib diisi!");
      return;
    }
    const validGrades = gridRows.filter((r) => r.subjectName.trim() !== "");
    if (validGrades.length === 0) {
      alert("Belum ada mata pelajaran dan nilai untuk disimpan.");
      return;
    }

    setSavingTranscripts(true);
    try {
      const payload = {
        academicYear: selectedYear,
        semester: selectedSemester,
        grades: validGrades.map((r) => {
          const customData: Record<string, string> = {};
          columns.forEach((col) => {
            if (col.isCustom) {
              customData[col.label] = String(r[col.key] || "");
            }
          });

          let finalNotes = r.notes || "";
          if (Object.keys(customData).length > 0) {
            finalNotes = JSON.stringify({ notes: r.notes || "", custom: customData });
          }

          return {
            subjectName: r.subjectName.trim(),
            subjectCode: r.subjectCode.trim() || null,
            score: parseFloat(r.score as string) || 0,
            scoreLetter: r.scoreLetter.trim() || null,
            notes: finalNotes || null,
          };
        }),
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

  // --- Transcript CRUD ---
  const handleTranscriptSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!alumni) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const scoreVal = parseFloat(formData.get("score") as string) || 0;
    const letterInput = formData.get("scoreLetter") as string;
    const payload = {
      academicYear: formData.get("academicYear"),
      semester: formData.get("semester"),
      subjectName: formData.get("subjectName"),
      subjectCode: (formData.get("subjectCode") as string) || null,
      score: scoreVal,
      scoreLetter: letterInput ? letterInput : scoreToLetter(scoreVal),
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
    } catch {
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
    } catch {
      alert("Gagal menghapus transkrip nilai");
    }
  };

  // --- Attendance CRUD ---
  const handleAttendanceSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!alumni) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      academicYear: formData.get("academicYear"),
      semester: formData.get("semester"),
      present: parseInt(formData.get("present") as string) || 0,
      sick: parseInt(formData.get("sick") as string) || 0,
      permission: parseInt(formData.get("permission") as string) || 0,
      absent: parseInt(formData.get("absent") as string) || 0,
    };
    try {
      if (attendanceMode === "add") {
        await goPost(`/api/alumni/${alumni.id}/attendance`, payload);
      } else if (editingAttendance) {
        await goPut(`/api/alumni/attendance/${editingAttendance.id}`, payload);
      }
      setAttendanceOpen(false);
      fetchAlumni();
    } catch {
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
    } catch {
      alert("Gagal menghapus rekap kehadiran");
    }
  };

  // --- Achievement CRUD ---
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
    } catch {
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
    } catch {
      alert("Gagal menghapus prestasi");
    }
  };

  // --- Ekskul CRUD ---
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
    } catch {
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
    } catch {
      alert("Gagal menghapus ekstrakurikuler");
    }
  };

  // --- Health CRUD ---
  const handleHealthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!alumni) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      year: formData.get("year"),
      weight: formData.get("weight") ? parseInt(formData.get("weight") as string) : null,
      height: formData.get("height") ? parseInt(formData.get("height") as string) : null,
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
    } catch {
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
    } catch {
      alert("Gagal menghapus catatan kesehatan");
    }
  };

  return {
    // Data
    alumni,
    loading,
    activeTab,
    submitting,
    // Tab
    setActiveTab,
    // Spreadsheet
    selectedYear,
    setSelectedYear,
    selectedSemester,
    setSelectedSemester,
    columns,
    gridRows,
    savingTranscripts,
    handleCellChange,
    handleKeyDown,
    handleRemoveRow,
    addRow,
    loadSDTemplate,
    // Column mgmt
    columnsOpen,
    setColumnsOpen,
    newColLabel,
    setNewColLabel,
    addCustomColumn,
    removeColumn,
    toggleStandardColumn,
    // Template mgmt
    templatesOpen,
    setTemplatesOpen,
    newTemplateName,
    setNewTemplateName,
    savedTemplates,
    saveCurrentAsTemplate,
    loadCustomTemplate,
    deleteTemplate,
    // Save bulk
    handleSaveTranscriptsBulk,
    // Dialogs
    transcriptOpen,
    setTranscriptOpen,
    transcriptMode,
    setTranscriptMode,
    editingTranscript,
    setEditingTranscript,
    attendanceOpen,
    setAttendanceOpen,
    attendanceMode,
    setAttendanceMode,
    editingAttendance,
    setEditingAttendance,
    achievementOpen,
    setAchievementOpen,
    achievementMode,
    setAchievementMode,
    editingAchievement,
    setEditingAchievement,
    ekskulOpen,
    setEkskulOpen,
    ekskulMode,
    setEkskulMode,
    editingEkskul,
    setEditingEkskul,
    healthOpen,
    setHealthOpen,
    healthMode,
    setHealthMode,
    editingHealth,
    setEditingHealth,
    // CRUD
    fetchAlumni,
    handleDelete,
    handleTranscriptSubmit,
    handleTranscriptDelete,
    handleAttendanceSubmit,
    handleAttendanceDelete,
    handleAchievementSubmit,
    handleAchievementDelete,
    handleEkskulSubmit,
    handleEkskulDelete,
    handleHealthSubmit,
    handleHealthDelete,
  };
}