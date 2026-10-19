"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  FileDown,
  GripVertical,
  Trash2,
} from "lucide-react";
import { goGet } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/toast";
import { exportToPDF, exportToWord } from "@/lib/bank-soal-export";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";

interface Question {
  id: string;
  bankId: string;
  type: string;
  content: string;
  options?: string;
  correctAnswer?: string;
  points: number;
  difficulty: string;
  orderNumber: number;
  mediaUrl?: string;
}

interface QuestionBank {
  id: string;
  title: string;
  subjectName?: string;
  className?: string;
}

export default function TabCetak() {
  const { settings } = useSchoolSettings();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const [filterBank, setFilterBank] = useState("");
  const [filterType, setFilterType] = useState("");
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [examTitle, setExamTitle] = useState("SOAL UJIAN");
  const [examSubtitle, setExamSubtitle] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [className, setClassName] = useState("");
  const [examDate, setExamDate] = useState("");

  const fetchBanks = async () => {
    try {
      const res: any = await goGet("/api/bank-soal/banks?limit=100");
      setBanks(res?.data || []);
    } catch { /* silent */ }
  };

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterBank && filterBank !== "all") params.append("bankId", filterBank);
      if (filterType && filterType !== "all") params.append("type", filterType);
      params.append("limit", "200");

      const result: any = await goGet(`/api/bank-soal/questions?${params.toString()}`);
      setAllQuestions(result?.data || []);
    } catch {
      showError("Gagal memuat soal");
    } finally {
      setIsLoading(false);
    }
  }, [filterBank, filterType]);

  useEffect(() => {
    fetchBanks();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const toggleQuestion = (q: Question) => {
    setSelectedQuestions((prev) => {
      const exists = prev.find((p) => p.id === q.id);
      if (exists) {
        return prev.filter((p) => p.id !== q.id);
      }
      return [...prev, q];
    });
  };

  const toggleAll = () => {
    const allIds = new Set(allQuestions.map((q) => q.id));
    const selectedIds = new Set(selectedQuestions.map((q) => q.id));
    const isAllSelected = allQuestions.length > 0 && allIds.size === selectedIds.size && [...allIds].every((id) => selectedIds.has(id));
    if (isAllSelected) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions([...allQuestions]);
    }
  };

  const removeSelected = (id: string) => {
    setSelectedQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  // Drag & drop reorder
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;

    const newQuestions = [...selectedQuestions];
    const dragged = newQuestions[dragIdx];
    newQuestions.splice(dragIdx, 1);
    newQuestions.splice(idx, 0, dragged);
    setSelectedQuestions(newQuestions);
    setDragIdx(idx);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
  };

  const handleExportPDF = async () => {
    if (selectedQuestions.length === 0) {
      showError("Pilih soal terlebih dahulu");
      return;
    }
    setIsExporting(true);
    try {
      await exportToPDF(selectedQuestions, {
        title: examTitle,
        subtitle: examSubtitle || undefined,
        shuffleOptions,
        shuffleQuestions,
        showAnswers,
        schoolName: settings?.school_name || undefined,
        academicYear: settings?.current_academic_year || undefined,
        subjectName: subjectName || selectedBank?.subjectName || undefined,
        className: className || selectedBank?.className || undefined,
        examDate: examDate || undefined,
      });
      showSuccess("PDF berhasil diunduh");
    } catch {
      showError("Gagal membuat PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportWord = async () => {
    if (selectedQuestions.length === 0) {
      showError("Pilih soal terlebih dahulu");
      return;
    }
    setIsExporting(true);
    try {
      await exportToWord(selectedQuestions, {
        title: examTitle,
        subtitle: examSubtitle || undefined,
        shuffleOptions,
        shuffleQuestions,
        showAnswers,
        schoolName: settings?.school_name || undefined,
        academicYear: settings?.current_academic_year || undefined,
        subjectName: subjectName || selectedBank?.subjectName || undefined,
        className: className || selectedBank?.className || undefined,
        examDate: examDate || undefined,
      });
      showSuccess("Word berhasil diunduh");
    } catch {
      showError("Gagal membuat Word");
    } finally {
      setIsExporting(false);
    }
  };

  const totalPoints = selectedQuestions.reduce((sum, q) => sum + q.points, 0);
  const selectedBank = banks.find((b) => b.id === filterBank);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold">Assembly & Cetak Soal</h2>
        <p className="text-xs text-muted-foreground">
          Pilih soal dari bank, atur urutan, dan cetak sebagai PDF atau Word
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Question Selection */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={filterBank} onValueChange={setFilterBank}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Semua Bank Soal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Bank Soal</SelectItem>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Semua Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="pg_single">PG Tunggal</SelectItem>
                <SelectItem value="pg_multi">PG Multi</SelectItem>
                <SelectItem value="true_false">Benar/Salah</SelectItem>
                <SelectItem value="fill_blank">Isian</SelectItem>
                <SelectItem value="matching">Menjodohkan</SelectItem>
                <SelectItem value="pair_match">Mencocokkan</SelectItem>
                <SelectItem value="essay">Esai</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selectedQuestions.length === allQuestions.length ? "Batal Pilih Semua" : "Pilih Semua"}
            </Button>
          </div>

          {/* Questions List */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : allQuestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Tidak ada soal ditemukan</p>
                </div>
              ) : (
                <div className="divide-y max-h-[500px] overflow-y-auto">
                  {allQuestions.map((q) => {
                    const isSelected = selectedQuestions.some((s) => s.id === q.id);
                    return (
                      <div
                        key={q.id}
                        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                          isSelected ? "bg-blue-50 dark:bg-blue-950/20" : "hover:bg-slate-50"
                        }`}
                        onClick={() => toggleQuestion(q)}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-1">{q.content}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">
                              {q.type.replace("_", " ").toUpperCase()}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{q.points} poin</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Assembly Panel */}
        <div className="space-y-4">
          {/* Export Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Pengaturan Cetak</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Judul Soal</Label>
                <Input
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="SOAL UJIAN"
                />
              </div>
              <div className="space-y-2">
                <Label>Subjudul (Opsional)</Label>
                <Input
                  value={examSubtitle}
                  onChange={(e) => setExamSubtitle(e.target.value)}
                  placeholder="Ulangan Tengah Semester 1"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Mata Pelajaran</Label>
                  <Input
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder={selectedBank?.subjectName || "Otomatis dari bank"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kelas</Label>
                  <Input
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder={selectedBank?.className || "Otomatis dari bank"}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tanggal Ujian (Opsional)</Label>
                <DateInput
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Acak Opsi</p>
                  <p className="text-[10px] text-muted-foreground">Urutan opsi jawaban diacak</p>
                </div>
                <Switch checked={shuffleOptions} onCheckedChange={setShuffleOptions} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Acak Urutan Soal</p>
                  <p className="text-[10px] text-muted-foreground">Urutan soal diacak saat dicetak</p>
                </div>
                <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Tampilkan Kunci</p>
                  <p className="text-[10px] text-muted-foreground">Sertakan halaman kunci jawaban</p>
                </div>
                <Switch checked={showAnswers} onCheckedChange={setShowAnswers} />
              </div>
            </CardContent>
          </Card>

          {/* Selected Questions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Soal Dipilih</span>
                <Badge>{selectedQuestions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedQuestions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Pilih soal dari daftar di sebelah kiri
                </p>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground">
                    Total: <strong>{totalPoints} poin</strong>
                  </div>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {selectedQuestions.map((q, idx) => (
                      <div
                        key={q.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-2 p-2 rounded text-xs bg-slate-50 dark:bg-zinc-900 cursor-move ${
                          dragIdx === idx ? "opacity-50" : ""
                        }`}
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-medium text-muted-foreground">{idx + 1}.</span>
                        <span className="flex-1 truncate">{q.content}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={() => removeSelected(q.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Export Buttons */}
          <div className="space-y-2">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleExportPDF}
              disabled={isExporting || selectedQuestions.length === 0}
            >
              {isExporting ? (
                "Membuat..."
              ) : (
                <>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export PDF
                </>
              )}
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={handleExportWord}
              disabled={isExporting || selectedQuestions.length === 0}
            >
              {isExporting ? (
                "Membuat..."
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Export Word
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
