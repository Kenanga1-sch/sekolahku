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
import { scoreToLetter } from "./alumni-spreadsheet-helpers";
import { useTranscriptGrid } from "./use-transcript-grid";

export { scoreToLetter, getAcademicYearOptions } from "./alumni-spreadsheet-helpers";
export type { ColumnDef, SavedTemplate } from "./alumni-spreadsheet-helpers";

export function useAlumniDetail() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [alumni, setAlumni] = useState<AlumniDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("documents");
  const [submitting, setSubmitting] = useState(false);
  const [savingTranscripts, setSavingTranscripts] = useState(false);

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

  // --- Spreadsheet sub-hook (kolom, baris, template lokal) ---
  const grid = useTranscriptGrid(alumni);
  const { selectedYear, selectedSemester, columns, gridRows } = grid;

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
    // Spreadsheet (dari sub-hook useTranscriptGrid)
    ...grid,
    savingTranscripts,
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