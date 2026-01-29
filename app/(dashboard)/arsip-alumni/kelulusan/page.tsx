"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Users,
  CheckCircle,
  Loader2,
  Search,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface Student {
  id: string;
  nisn: string | null;
  nis: string | null;
  fullName: string;
  gender: string | null;
  className: string | null;
}

type WizardStep = 1 | 2 | 3;

export default function KelulusanPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  
  // Graduation settings
  const currentYear = new Date().getFullYear();
  const [graduationYear, setGraduationYear] = useState(`${currentYear - 1}/${currentYear}`);
  const [graduationDate, setGraduationDate] = useState(new Date().toISOString().split("T")[0]);
  const [deactivateStudents, setDeactivateStudents] = useState(true);

  // Result
  const [result, setResult] = useState<{ alumni: any[]; deactivated: number } | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await fetch("/api/peserta-didik?isActive=true&limit=1000");
        const data = await response.json();
        // Filter only class 6 students (graduating class)
        const class6Students = (data.data || data || []).filter(
          (s: Student) => s.className?.startsWith("6")
        );
        setStudents(class6Students);
      } catch (err) {
        console.error("Error fetching students:", err);
        setError("Gagal memuat data siswa");
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.nisn?.includes(searchQuery) ||
      student.nis?.includes(searchQuery);
    const matchesClass = classFilter === "all" || student.className === classFilter;
    return matchesSearch && matchesClass;
  });

  const uniqueClasses = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map((s) => s.id));
    }
  };

  const handleGraduate = async () => {
    if (selectedStudents.length === 0) {
      setError("Pilih minimal satu siswa");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/alumni/graduate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudents,
          graduationYear,
          graduationDate,
          deactivateStudents,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Gagal memproses kelulusan");
      }

      const data = await response.json();
      setResult(data);
      setSuccess(true);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setProcessing(false);
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const year = currentYear - i;
    return `${year - 1}/${year}`;
  });

  const progressPercentage = ((step - 1) / 2) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/arsip-alumni">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Proses Kelulusan
          </h1>
          <p className="text-muted-foreground">
            Transfer data siswa kelas 6 ke arsip alumni
          </p>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className={step >= 1 ? "font-medium text-primary" : "text-muted-foreground"}>
                1. Pilih Siswa
              </span>
              <span className={step >= 2 ? "font-medium text-primary" : "text-muted-foreground"}>
                2. Pengaturan
              </span>
              <span className={step >= 3 ? "font-medium text-primary" : "text-muted-foreground"}>
                3. Selesai
              </span>
            </div>
            <Progress value={progressPercentage} />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Select Students */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Pilih Siswa yang Lulus
              </CardTitle>
              <CardDescription>
                Pilih siswa kelas 6 yang akan diluluskan dan ditransfer ke arsip alumni
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama, NISN, NIS..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kelas</SelectItem>
                    {uniqueClasses.map((cls) => (
                      <SelectItem key={cls} value={cls!}>
                        {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selection Info */}
              <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                <span className="text-sm">
                  <strong>{selectedStudents.length}</strong> dari{" "}
                  <strong>{filteredStudents.length}</strong> siswa dipilih
                </span>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedStudents.length === filteredStudents.length
                    ? "Batalkan Semua"
                    : "Pilih Semua"}
                </Button>
              </div>

              {/* Table */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Tidak ada siswa kelas 6 yang ditemukan</p>
                </div>
              ) : (
                <div className="border rounded-lg max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedStudents.length === filteredStudents.length}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>NISN</TableHead>
                        <TableHead>NIS</TableHead>
                        <TableHead>Kelas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow
                          key={student.id}
                          className={selectedStudents.includes(student.id) ? "bg-primary/5" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedStudents.includes(student.id)}
                              onCheckedChange={() => toggleStudent(student.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{student.fullName}</TableCell>
                          <TableCell>{student.nisn || "-"}</TableCell>
                          <TableCell>{student.nis || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{student.className}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end mt-6">
            <Button
              onClick={() => setStep(2)}
              disabled={selectedStudents.length === 0}
            >
              Lanjutkan
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 2: Settings */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Kelulusan</CardTitle>
              <CardDescription>
                Konfigurasi data kelulusan untuk {selectedStudents.length} siswa terpilih
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tahun Ajaran Kelulusan</Label>
                  <Select value={graduationYear} onValueChange={setGraduationYear}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tanggal Kelulusan</Label>
                  <Input
                    type="date"
                    value={graduationDate}
                    onChange={(e) => setGraduationDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg">
                <Checkbox
                  id="deactivate"
                  checked={deactivateStudents}
                  onCheckedChange={(checked) => setDeactivateStudents(checked as boolean)}
                />
                <div className="space-y-1">
                  <Label htmlFor="deactivate" className="cursor-pointer">
                    Nonaktifkan siswa setelah kelulusan
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Siswa yang lulus akan ditandai sebagai tidak aktif di data peserta didik
                  </p>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Proses ini akan membuat {selectedStudents.length} data alumni baru. 
                  Data siswa asli akan tetap tersimpan sebagai referensi.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Kembali
            </Button>
            <Button onClick={handleGraduate} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <GraduationCap className="h-4 w-4 mr-1" />
                  Proses Kelulusan
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Success */}
      {step === 3 && success && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="text-center space-y-4">
                <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold">Kelulusan Berhasil!</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {result?.alumni.length || selectedStudents.length} siswa telah berhasil 
                  diluluskan dan ditransfer ke arsip alumni.
                  {result?.deactivated ? ` ${result.deactivated} siswa dinonaktifkan.` : ""}
                </p>

                <div className="flex items-center justify-center gap-4 pt-6">
                  <Link href="/arsip-alumni">
                    <Button>
                      Lihat Arsip Alumni
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep(1);
                      setSelectedStudents([]);
                      setSuccess(false);
                      setResult(null);
                    }}
                  >
                    Proses Kelulusan Lagi
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
