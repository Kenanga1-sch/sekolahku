"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpCircle, Plus, Pencil, Trash2, ArrowRight, Tag } from "lucide-react";
import { goGet, goDelete, goPost } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import { Checkbox } from "@/components/ui/checkbox";

interface QuestionBank {
  id: string;
  title: string;
  subjectName?: string;
  questionCount?: number;
  kurikulumId?: string;
  kurikulumName?: string;
}

interface Kurikulum {
  id: string;
  name: string;
  isActive: boolean;
}

interface Question {
  id: string;
  bankId: string;
  type: string;
  content: string;
  mediaUrl?: string;
  options?: string;
  correctAnswer?: string;
  points: number;
  difficulty: string;
  bloomLevel?: string;
  tags?: string[];
}

const questionTypes = [
  { value: "pg_single", label: "PG Tunggal" },
  { value: "pg_multi", label: "PG Multi" },
  { value: "true_false", label: "Benar/Salah" },
  { value: "fill_blank", label: "Isian" },
  { value: "matching", label: "Menyambung" },
  { value: "pair_match", label: "Menjodohkan" },
  { value: "essay", label: "Esai" },
];

const difficulties = [
  { value: "easy", label: "Mudah", color: "bg-green-100 text-success" },
  { value: "medium", label: "Sedang", color: "bg-amber-100 text-amber-700" },
  { value: "hard", label: "Sulit", color: "bg-red-100 text-red-700" },
];

const bloomLevels = [
  { value: "remember", label: "Mengingat (C1)" },
  { value: "understand", label: "Memahami (C2)" },
  { value: "apply", label: "Menerapkan (C3)" },
  { value: "analyze", label: "Menganalisis (C4)" },
  { value: "evaluate", label: "Menilai (C5)" },
  { value: "create", label: "Mencipta (C6)" },
];

const typeColors: Record<string, string> = {
  pg_single: "bg-blue-100 text-blue-700",
  pg_multi: "bg-indigo-100 text-indigo-700",
  true_false: "bg-emerald-100 text-emerald-700",
  fill_blank: "bg-amber-100 text-amber-700",
  matching: "bg-purple-100 text-purple-700",
  pair_match: "bg-pink-100 text-pink-700",
  essay: "bg-slate-100 text-slate-700",
};

const typeLabels: Record<string, string> = {
  pg_single: "PG Tunggal",
  pg_multi: "PG Multi",
  true_false: "B/S",
  fill_blank: "Isian",
  matching: "Menyambung",
  pair_match: "Menjodohkan",
  essay: "Esai",
};

export default function TabSoal() {
  const router = useRouter();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [kurikulumList, setKurikulumList] = useState<Kurikulum[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [isLoading, setIsLoading] = useState(true);
  const [filterBank, setFilterBank] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterBloom, setFilterBloom] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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
      if (filterBloom && filterBloom !== "all") params.append("bloomLevel", filterBloom);
      if (filterTag.trim()) params.append("tag", filterTag.trim());
      params.append("limit", String(limit));
      params.append("page", String(page));

      const result: any = await goGet(`/api/bank-soal/questions?${params.toString()}`);
      setQuestions(result?.data || []);
      setTotal(result?.total || 0);
    } catch {
      showError("Gagal memuat daftar soal");
    } finally {
      setIsLoading(false);
    }
  }, [filterBank, filterType, filterBloom, filterTag, page]);

  useEffect(() => {
    fetchBanks();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Reset ke halaman 1 saat filter berubah.
  useEffect(() => {
    setPage(1);
  }, [filterBank, filterType, filterBloom, filterTag]);

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus soal ini?")) return;
    try {
      await goDelete(`/api/bank-soal/questions/${id}`);
      showSuccess("Soal berhasil dihapus");
      fetchQuestions();
    } catch {
      showError("Gagal menghapus soal");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (prev.size === questions.length) return new Set();
      return new Set(questions.map((q) => q.id));
    });
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Hapus ${selected.size} soal terpilih?`)) return;
    setIsBulkDeleting(true);
    try {
      await goPost("/api/bank-soal/questions/bulk-delete", { ids: [...selected] });
      showSuccess(`${selected.size} soal dihapus`);
      setSelected(new Set());
      fetchQuestions();
    } catch {
      showError("Gagal menghapus soal terpilih");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleCreate = () => {
    const qs = filterBank && filterBank !== "all" ? `?bankId=${filterBank}` : "";
    router.push(`/bank-soal/soal/baru${qs}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold">Kelola Soal</h2>
          <p className="text-xs text-muted-foreground">
            Buat dan kelola soal dengan berbagai format
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Buat Soal
        </Button>
      </div>

      {/* Empty state untuk banks */}
      {banks.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <HelpCircle className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Belum ada bank soal</p>
            <p className="text-xs mb-3">Buat bank soal terlebih dahulu untuk mulai membuat soal</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/bank-soal")}
            >
              Buka Bank Soal
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {banks.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Select value={filterBank} onValueChange={setFilterBank}>
            <SelectTrigger className="w-full sm:w-[220px]">
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
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Semua Tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              {questionTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterBloom} onValueChange={setFilterBloom}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Semua Level Bloom" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Level Bloom</SelectItem>
              {bloomLevels.map((b) => (
                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            placeholder="Filter tag..."
            className="w-full sm:w-[160px]"
          />
        </div>
      )}

      {/* Bulk action bar */}
      {questions.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={selected.size === questions.length && questions.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            Pilih semua di halaman ini
          </label>
          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {isBulkDeleting ? "Menghapus..." : `Hapus ${selected.size} soal`}
            </Button>
          )}
        </div>
      )}

      {/* Questions List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        banks.length > 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <HelpCircle className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">Belum ada soal</p>
              <p className="text-xs mb-3">Klik &quot;Buat Soal&quot; untuk mulai membuat</p>
              <Button
                size="sm"
                onClick={handleCreate}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Buat Soal Pertama
              </Button>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <Card key={q.id} className="hover:border-blue-300 transition-colors">
              <CardContent className="flex items-start gap-3 p-4">
                <Checkbox
                  checked={selected.has(q.id)}
                  onCheckedChange={() => toggleSelect(q.id)}
                  className="mt-1 shrink-0"
                />
                {q.mediaUrl ? (
                  <div className="shrink-0 w-16 h-16 rounded overflow-hidden bg-slate-100 dark:bg-zinc-800">
                    <img
                      src={q.mediaUrl}
                      alt="Lampiran"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : null}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge className={typeColors[q.type] || "bg-slate-100"}>
                      {typeLabels[q.type] || q.type}
                    </Badge>
                    <Badge variant="outline" className={difficulties.find(d => d.value === q.difficulty)?.color}>
                      {difficulties.find(d => d.value === q.difficulty)?.label}
                    </Badge>
                    {q.bloomLevel && (
                      <Badge variant="outline" className="bg-cyan-50 text-cyan-700">
                        {bloomLevels.find(b => b.value === q.bloomLevel)?.label || q.bloomLevel}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{q.points} poin</span>
                  </div>
                  <Link
                    href={`/bank-soal/soal/edit?id=${q.id}`}
                    className="block hover:underline"
                  >
                    <p className="text-sm line-clamp-2">{q.content}</p>
                  </Link>
                  {q.tags && q.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      {q.tags.map((t) => (
                        <span key={t} className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 px-1.5 py-0.5 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => router.push(`/bank-soal/soal/edit?id=${q.id}`)}
                    title="Edit soal"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(q.id)}
                    title="Hapus soal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">
            Halaman {page} dari {Math.ceil(total / limit)} ({total} soal)
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * limit >= total}
          >
            Selanjutnya
          </Button>
        </div>
      )}
    </div>
  );
}
