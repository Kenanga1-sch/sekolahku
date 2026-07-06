"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2, CalendarPlus, Sparkles, User, FileText, Calendar, Edit3, Check, ShieldAlert, ChevronRight } from "lucide-react";
import { goGet, goPost } from "@/lib/api-client";

interface ClassOption {
  id: string;
  name: string;
  teacherName?: string | null;
}

interface StaffOption {
  id: string;
  name: string;
  position?: string | null;
}

export default function BuatSesiPresensiPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existingSessionId, setExistingSessionId] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);

  // Form state
  const [className, setClassName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [notes, setNotes] = useState("");
  
  // UX Helper states
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [isManualTeacher, setIsManualTeacher] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingInitial(true);
      try {
        // 1. Fetch classes from academic classes for rich info (including teacher_name)
        let classesData: ClassOption[] = [];
        try {
          const classRes: any = await goGet("/api/academic/classes");
          classesData = classRes?.data || classRes || [];
        } catch (err) {
          console.warn("Failed fetching from academic classes, trying fallback /api/classes:", err);
          const fallbackRes: any = await goGet("/api/classes");
          const fallbackData = fallbackRes?.data || fallbackRes || [];
          classesData = fallbackData.map((c: any) => ({
            id: c.id || c.name,
            name: c.name,
          }));
        }
        setClasses(classesData);

        // 2. Fetch staff list for teacher suggestions
        try {
          const staffRes: any = await goGet("/api/public/staff?perPage=100");
          const staffData = staffRes?.data || staffRes?.items || [];
          setStaffList(staffData);
        } catch (err) {
          console.warn("Failed fetching staff profiles:", err);
        }

      } catch (err) {
        console.error("Error loading initial form data:", err);
      } finally {
        setLoadingInitial(false);
      }
    };
    
    fetchInitialData();
  }, []);

  const handleClassChange = (selectedClassName: string) => {
    setClassName(selectedClassName);
    const matchedClass = classes.find((c) => c.name === selectedClassName);
    
    if (matchedClass?.teacherName) {
      setTeacherName(matchedClass.teacherName);
      setIsAutoFilled(true);
      setIsManualTeacher(true); // Switch to manual text mode to show the auto-filled name
    } else {
      setTeacherName("");
      setIsAutoFilled(false);
      setIsManualTeacher(false); // Default back to dropdown
    }
  };

  const handleTeacherSelect = (val: string) => {
    if (val === "__manual__") {
      setIsManualTeacher(true);
      setTeacherName("");
      setIsAutoFilled(false);
    } else {
      setTeacherName(val);
      setIsAutoFilled(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!className) {
      setError("Pilih kelas terlebih dahulu");
      return;
    }

    setLoading(true);
    setError(null);
    setExistingSessionId(null);

    try {
      const data: any = await goPost("/api/attendance/sessions", {
        className,
        teacherName,
        notes,
      });

      router.push(`/presensi/sesi/detail?id=${data.id || data.data?.id}`);
    } catch (err: any) {
      if (err.status === 409) {
        setError("Sesi untuk kelas ini sudah ada hari ini");
        if (err.data?.existing?.id) {
          setExistingSessionId(err.data.existing.id);
        } else if (err.data?.id) {
          setExistingSessionId(err.data.id);
        }
      } else {
        setError(err.message || "Terjadi kesalahan saat membuat sesi");
      }
    } finally {
      setLoading(false);
    }
  };

  const getIndonesianDate = () => {
    return new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const defaultClasses = [
    "1A", "1B", "2A", "2B", "3A", "3B",
    "4A", "4B", "5A", "5B", "6A", "6B",
  ];

  return (
    <div className="space-y-6 max-w-xl mx-auto px-4 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/presensi">
          <Button variant="outline" size="icon" className="border-slate-200 bg-white shadow-sm hover:bg-slate-50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-slate-800">
            <CalendarPlus className="h-6 w-6 text-primary" />
            Buat Sesi Presensi Baru
          </h1>
          <p className="text-sm text-muted-foreground">
            Buka lembar absensi kelas untuk merekam kehadiran hari ini
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50/50">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          <AlertTitle className="font-semibold text-red-800">Gagal Membuat Sesi</AlertTitle>
          <AlertDescription className="text-xs text-red-700 flex flex-col gap-2 mt-1">
            <span>{error}</span>
            {existingSessionId && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-fit border-red-200 bg-white hover:bg-red-50 text-red-800 font-semibold"
              >
                <Link href={`/presensi/sesi/detail?id=${existingSessionId}`}>
                  Lihat Sesi Yang Ada
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {loadingInitial ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Memuat data kelas dan daftar guru...</p>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit}>
          <Card className="border-slate-200/80 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Formulir Detail Sesi</CardTitle>
                  <CardDescription className="text-xs">Isi data rombel kelas dan guru pendamping</CardDescription>
                </div>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-150 flex items-center gap-1 py-0.5 px-2 font-medium">
                  <Calendar className="h-3 w-3" />
                  {getIndonesianDate()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              
              {/* Class Selection */}
              <div className="space-y-2">
                <Label htmlFor="className" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Rombongan Belajar (Kelas) *
                </Label>
                <Select value={className} onValueChange={handleClassChange}>
                  <SelectTrigger className="border-slate-200 focus:ring-primary focus:border-primary">
                    <SelectValue placeholder="Pilih Rombel Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {(classes.length > 0
                      ? classes.map((c) => c.name)
                      : defaultClasses
                    ).map((cls) => (
                      <SelectItem key={cls} value={cls}>
                        Kelas {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Siswa yang terdaftar pada kelas terpilih akan otomatis diikutsertakan dalam sesi absensi.
                </p>
              </div>

              {/* Teacher Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="teacherName" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Guru / Wali Kelas (Opsional)
                  </Label>
                  {isAutoFilled && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium py-0 px-1.5 flex items-center gap-0.5">
                      <Sparkles className="h-2.5 w-2.5" />
                      Auto-Wali Kelas
                    </Badge>
                  )}
                </div>

                {!isManualTeacher && staffList.length > 0 ? (
                  <div className="flex gap-2">
                    <Select value={teacherName} onValueChange={handleTeacherSelect}>
                      <SelectTrigger className="border-slate-200 focus:ring-primary focus:border-primary flex-1">
                        <SelectValue placeholder="Pilih nama guru..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staffList.map((staff) => (
                          <SelectItem key={staff.id} value={staff.name}>
                            {staff.name} {staff.position ? `(${staff.position})` : ""}
                          </SelectItem>
                        ))}
                        <SelectItem value="__manual__" className="text-primary font-semibold border-t mt-1 pt-1.5">
                          ✍️ Input Nama Manual...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <User className="h-4 w-4" />
                    </span>
                    <Input
                      id="teacherName"
                      value={teacherName}
                      onChange={(e) => {
                        setTeacherName(e.target.value);
                        setIsAutoFilled(false);
                      }}
                      placeholder="Masukkan nama guru pendamping..."
                      className="pl-9 border-slate-200 focus:ring-primary focus:border-primary"
                    />
                    {staffList.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setIsManualTeacher(false);
                          setTeacherName("");
                          setIsAutoFilled(false);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 text-[10px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                      >
                        Pilih dari Daftar
                      </Button>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Nama guru wali kelas atau pengawas presensi yang bertanggung jawab.
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Catatan Sesi (Opsional)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-3.5 text-slate-400">
                    <FileText className="h-4 w-4" />
                  </span>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Masukkan catatan pendukung, misal: 'Ujian Tengah Semester' atau 'Pertemuan Rutin'..."
                    rows={3}
                    className="pl-9 border-slate-200 focus:ring-primary focus:border-primary pt-2.5"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <Button asChild type="button" variant="outline" className="border-slate-200 hover:bg-slate-50 font-medium h-10 px-5">
                  <Link href="/presensi">Batal</Link>
                </Button>
                <Button type="submit" disabled={loading || !className} className="shadow-sm font-semibold h-10 px-5">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Check className="h-4.5 w-4.5 mr-1.5" />
                      Aktifkan Sesi Presensi
                    </>
                  )}
                </Button>
              </div>

            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
