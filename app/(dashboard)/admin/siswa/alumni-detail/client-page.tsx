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
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Hapus
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarImage src={alumni.photo || undefined} />
                  <AvatarFallback className="text-2xl">
                    {alumni.fullName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-semibold">{alumni.fullName}</h3>
                
                {alumni.status === "graduated" && (
                  <Badge variant="secondary" className="mt-1">
                    Lulus {alumni.graduationYear}
                  </Badge>
                )}

                <div className="w-full mt-6 space-y-3 text-left">
                  {alumni.nisn && (
                    <div className="flex items-center gap-3 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>NISN: {alumni.nisn}</span>
                    </div>
                  )}
                  {alumni.nis && (
                    <div className="flex items-center gap-3 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>NIS: {alumni.nis}</span>
                    </div>
                  )}
                  {alumni.finalClass && (
                    <div className="flex items-center gap-3 text-sm">
                      <School className="h-4 w-4 text-muted-foreground" />
                      <span>Kelas Akhir: {alumni.finalClass}</span>
                    </div>
                  )}
                  {alumni.nextSchool && alumni.status === "graduated" && (
                    <div className="flex items-center gap-3 text-sm">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span>Sekolah Lanjutan: {alumni.nextSchool}</span>
                    </div>
                  )}
                  {alumni.currentPhone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{alumni.currentPhone}</span>
                    </div>
                  )}
                  {alumni.currentEmail && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{alumni.currentEmail}</span>
                    </div>
                  )}
                  {alumni.currentAddress && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="line-clamp-2">{alumni.currentAddress}</span>
                    </div>
                  )}
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
          className="lg:col-span-2"
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
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-primary" />
                          Transkrip Nilai Semester
                        </CardTitle>
                        <Button size="sm" onClick={() => {
                          setEditingTranscript(null);
                          setTranscriptMode("add");
                          setTranscriptOpen(true);
                        }}>
                          <Plus className="h-4 w-4 mr-1" />
                          Tambah Nilai
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {alumni.transcripts.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>Belum ada transkrip nilai disimpan</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tahun Ajaran</TableHead>
                                  <TableHead>Semester</TableHead>
                                  <TableHead>Mata Pelajaran</TableHead>
                                  <TableHead>Kode</TableHead>
                                  <TableHead>Angka</TableHead>
                                  <TableHead>Huruf</TableHead>
                                  <TableHead>Catatan</TableHead>
                                  <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {alumni.transcripts.map((t) => (
                                  <TableRow key={t.id}>
                                    <TableCell className="font-medium">{t.academicYear}</TableCell>
                                    <TableCell>{t.semester}</TableCell>
                                    <TableCell className="font-semibold">{t.subjectName}</TableCell>
                                    <TableCell className="font-mono text-xs">{t.subjectCode || "-"}</TableCell>
                                    <TableCell>{t.score.toFixed(1)}</TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">{t.scoreLetter || "-"}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{t.notes || "-"}</TableCell>
                                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => {
                                        setEditingTranscript(t);
                                        setTranscriptMode("edit");
                                        setTranscriptOpen(true);
                                      }}>
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleTranscriptDelete(t.id)}>
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
