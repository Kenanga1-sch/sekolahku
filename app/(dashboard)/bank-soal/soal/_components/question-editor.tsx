"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Eye, EyeOff } from "lucide-react";
import { goGet, goPost, goPut } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import { QuestionTypePicker } from "./question-type-picker";
import { ChoiceListEditor, type Choice } from "./choice-list-editor";
import { PairMatchEditor, type MatchPair } from "./pair-match-editor";
import { FillBlankEditor, type FillBlankAnswer } from "./fill-blank-editor";
import { QuestionPreview } from "./question-preview";
import { MediaUploader } from "./media-uploader";

interface QuestionBank {
  id: string;
  title: string;
  subjectName?: string;
  kurikulumName?: string;
}

interface QuestionData {
  id: string;
  bankId: string;
  type: string;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  options?: string;
  correctAnswer?: string;
  explanation?: string;
  points: number;
  difficulty: string;
  bloomLevel?: string;
  tags?: string[];
}

const difficulties = [
  { value: "easy", label: "Mudah" },
  { value: "medium", label: "Sedang" },
  { value: "hard", label: "Sulit" },
];

const bloomLevels = [
  { value: "remember", label: "Mengingat (C1)" },
  { value: "understand", label: "Memahami (C2)" },
  { value: "apply", label: "Menerapkan (C3)" },
  { value: "analyze", label: "Menganalisis (C4)" },
  { value: "evaluate", label: "Menilai (C5)" },
  { value: "create", label: "Mencipta (C6)" },
];

interface QuestionEditorProps {
  questionId?: string;
  initialData?: QuestionData;
  presetBankId?: string;
}

export default function QuestionEditor({
  questionId,
  initialData,
  presetBankId,
}: QuestionEditorProps) {
  const router = useRouter();
  const isEditing = !!questionId;

  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [bankId, setBankId] = useState(initialData?.bankId || presetBankId || "");
  const [type, setType] = useState(initialData?.type || "pg_single");
  const [content, setContent] = useState(initialData?.content || "");
  const [explanation, setExplanation] = useState(initialData?.explanation || "");
  const [points, setPoints] = useState(String(initialData?.points || 1));
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || "medium");
  const [bloomLevel, setBloomLevel] = useState(initialData?.bloomLevel || "__none__");
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(initialData?.mediaUrl || "");
  const [mediaType, setMediaType] = useState(initialData?.mediaType || "");

  // State per-tipe
  const [choices, setChoices] = useState<Choice[]>([
    { id: "1", text: "", isCorrect: false },
    { id: "2", text: "", isCorrect: false },
  ]);
  const [pairs, setPairs] = useState<MatchPair[]>([
    { id: "1", left: "", right: "", rightId: "r1" },
    { id: "2", left: "", right: "", rightId: "r2" },
  ]);
  const [fillAnswer, setFillAnswer] = useState<FillBlankAnswer>({ keyword: "", alternatives: [] });

  // Parse initialData saat edit
  useEffect(() => {
    if (!initialData) return;
    setBankId(initialData.bankId);
    setType(initialData.type);
    setContent(initialData.content);
    setExplanation(initialData.explanation || "");
    setPoints(String(initialData.points));
    setDifficulty(initialData.difficulty);
    setBloomLevel(initialData.bloomLevel || "__none__");
    setTags(initialData.tags || []);
    setMediaUrl(initialData.mediaUrl || "");
    setMediaType(initialData.mediaType || "");

    if (initialData.options) {
      // Matching/pair_match: options = array pasangan {id,left,right,rightId}
      if (initialData.type === "matching" || initialData.type === "pair_match") {
        try {
          const parsed: MatchPair[] = JSON.parse(initialData.options);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPairs(
              parsed.map((p: any) => ({
                id: String(p.id ?? ""),
                left: String(p.left ?? ""),
                right: String(p.right ?? ""),
                rightId: p.rightId ? String(p.rightId) : `r${p.id}`,
              }))
            );
          }
        } catch { /* options tidak valid, biarkan default */ }
      } else {
        try {
          const parsed: Choice[] = JSON.parse(initialData.options);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChoices(parsed);
          }
        } catch {
        // legacy "A|B|C|D"
        const parts = initialData.options.split("|");
        setChoices(
          parts.map((p, i) => ({
            id: String(i + 1),
            text: p.trim(),
            isCorrect: initialData.correctAnswer
              ? p.trim().toLowerCase() === initialData.correctAnswer.toLowerCase()
              : false,
          }))
        );
      }
      }
    }

    if (initialData.type === "fill_blank" && initialData.correctAnswer) {
      try {
        const arr: string[] = JSON.parse(initialData.correctAnswer);
        if (Array.isArray(arr)) {
          setFillAnswer({ keyword: arr[0] || "", alternatives: arr.slice(1) });
        }
      } catch {
        setFillAnswer({ keyword: initialData.correctAnswer, alternatives: [] });
      }
    }
  }, [initialData]);

  // Fetch banks
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const res: any = await goGet("/api/bank-soal/banks?limit=100");
        setBanks(res?.data || []);
      } catch {
        /* silent */
      }
    };
    fetchBanks();
  }, []);

  // Reset state saat ganti tipe
  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (newType === "pg_single" || newType === "pg_multi") {
      if (choices.length < 2) {
        setChoices([
          { id: "1", text: "", isCorrect: false },
          { id: "2", text: "", isCorrect: false },
        ]);
      }
    } else if (newType === "true_false") {
      setChoices([
        { id: "1", text: "Benar", isCorrect: true },
        { id: "2", text: "Salah", isCorrect: false },
      ]);
    } else if (newType === "matching" || newType === "pair_match") {
      if (pairs.length < 2) {
        setPairs([
          { id: "1", left: "", right: "", rightId: "r1" },
          { id: "2", left: "", right: "", rightId: "r2" },
        ]);
      }
    }
  };

  // Validasi
  const isValid = useCallback(() => {
    if (!bankId || !content.trim()) return false;
    if (type === "pg_single" || type === "pg_multi") {
      if (choices.length < 2) return false;
      if (choices.some((c) => !c.text.trim())) return false;
      if (!choices.some((c) => c.isCorrect)) return false;
    } else if (type === "true_false") {
      if (!choices.some((c) => c.isCorrect)) return false;
    } else if (type === "fill_blank") {
      if (!fillAnswer.keyword.trim()) return false;
    } else if (type === "matching" || type === "pair_match") {
      if (pairs.length < 2) return false;
      if (pairs.some((p) => !p.left.trim() || !p.right.trim())) return false;
    }
    return true;
  }, [bankId, content, type, choices, fillAnswer, pairs]);

  // Build request body
  const buildBody = () => {
    const body: any = {
      bankId,
      type,
      content,
      points: parseInt(points) || 1,
      difficulty,
      // Kirim string kosong (bukan null) saat tidak ada gambar — backend
      // UpdateQuestion hanya menulis saat pointer non-nil, jadi null diabaikan
      // dan penghapusan gambar tidak akan tersimpan. "" → pointer non-nil.
      mediaUrl: mediaUrl || "",
      mediaType: mediaUrl ? (mediaType || "image") : "",
      // Tags selalu dikirim (array kosong = hapus semua).
      tags,
    };
    // Bloom: kirim "" untuk menghapus, nilai valid untuk menyetel.
    body.bloomLevel = bloomLevel === "__none__" ? "" : bloomLevel;
    if (explanation.trim()) body.explanation = explanation;

    if (type === "pg_single" || type === "pg_multi" || type === "true_false") {
      body.options = JSON.stringify(choices);
      const correct = choices.filter((c) => c.isCorrect);
      if (type === "pg_single" || type === "true_false") {
        body.correctAnswer = correct[0]?.text || "";
      } else {
        // Kontrak baru: array TEKS pilihan benar (bukan ID).
        body.correctAnswer = JSON.stringify(correct.map((c) => c.text));
      }
    } else if (type === "fill_blank") {
      const all = [fillAnswer.keyword, ...fillAnswer.alternatives].filter((s) => s.trim());
      body.correctAnswer = JSON.stringify(all);
    } else if (type === "matching" || type === "pair_match") {
      // correctAnswer = { leftId: rightId } sesuai harapan grading.
      const mapping: Record<string, string> = {};
      pairs.forEach((p) => {
        mapping[p.id] = p.rightId || `r${p.id}`;
      });
      body.options = JSON.stringify(
        pairs.map((p) => ({ id: p.id, left: p.left, right: p.right, rightId: p.rightId || `r${p.id}` }))
      );
      body.correctAnswer = JSON.stringify(mapping);
    }

    return body;
  };

  const handleSave = async () => {
    if (!isValid()) {
      showError("Lengkapi semua field yang wajib diisi");
      return;
    }
    setIsSaving(true);
    try {
      const body = buildBody();
      if (isEditing) {
        await goPut(`/api/bank-soal/questions/${questionId}`, body);
        showSuccess("Soal berhasil diperbarui");
      } else {
        await goPost("/api/bank-soal/questions", body);
        showSuccess("Soal berhasil dibuat");
      }
      router.push("/bank-soal#soal");
      router.refresh();
    } catch {
      showError(isEditing ? "Gagal memperbarui soal" : "Gagal membuat soal");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/bank-soal")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">
              {isEditing ? "Edit Soal" : "Buat Soal Baru"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEditing ? "Perbarui konten soal" : "Lengkapi form di bawah untuk membuat soal"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnswers((v) => !v)}
          >
            {showAnswers ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showAnswers ? "Sembunyikan Jawaban" : "Tampilkan Jawaban"}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !isValid()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Menyimpan..." : isEditing ? "Simpan" : "Buat Soal"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Form */}
        <div className="space-y-6">
          {/* Bank & Type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">1. Pilih Bank Soal &amp; Tipe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Bank Soal *</Label>
                {banks.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs">
                    <p className="text-amber-700 dark:text-amber-400 font-medium">
                      Belum ada bank soal
                    </p>
                    <p className="text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                      Buat bank soal terlebih dahulu di tab &quot;Bank Soal&quot; sebelum membuat soal.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 border-amber-300 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:border-amber-800"
                      onClick={() => router.push("/bank-soal#bank")}
                    >
                      Buka Tab Bank Soal
                    </Button>
                  </div>
                ) : (
                  <Select value={bankId} onValueChange={setBankId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Bank Soal" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.title}
                          {b.subjectName ? ` — ${b.subjectName}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Tipe Soal *</Label>
                <QuestionTypePicker value={type} onChange={handleTypeChange} />
              </div>
            </CardContent>
          </Card>

          {/* Konten */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">2. Konten Soal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label>Pertanyaan *</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tulis pertanyaan di sini..."
              />
            </CardContent>
          </Card>

          {/* Media / Lampiran */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">3. Media / Lampiran (Opsional)</CardTitle>
            </CardHeader>
            <CardContent>
              <MediaUploader
                value={mediaUrl}
                onChange={(url, type) => { setMediaUrl(url || ""); setMediaType(type || ""); }}
                disabled={isSaving}
                allow="all"
              />
            </CardContent>
          </Card>

          {/* Jawaban (conditional) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">4. Jawaban</CardTitle>
            </CardHeader>
            <CardContent>
              {(type === "pg_single" || type === "pg_multi" || type === "true_false") && (
                <ChoiceListEditor
                  mode={type === "pg_multi" ? "multi" : type === "true_false" ? "true_false" : "single"}
                  value={choices}
                  onChange={setChoices}
                />
              )}
              {type === "fill_blank" && (
                <FillBlankEditor value={fillAnswer} onChange={setFillAnswer} />
              )}
              {(type === "matching" || type === "pair_match") && (
                <PairMatchEditor value={pairs} onChange={setPairs} />
              )}
              {type === "essay" && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-700 dark:text-blue-400">
                  Soal esai tidak memerlukan jawaban otomatis. Tulis kunci jawaban/panduan penilaian di
                  bagian &quot;Pembahasan&quot; di bawah.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pembahasan & Pengaturan */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">5. Pembahasan &amp; Pengaturan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Pembahasan / Kunci Jawaban (Opsional)</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Penjelasan jawaban atau kunci jawaban..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Poin</Label>
                  <Input
                    type="number"
                    min="1"
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Nilai soal saat dinilai. 1 = standar, naikkan untuk soal yang lebih sulit.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Level Kesulitan</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {difficulties.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Level Kognitif (Taksonomi Bloom)</Label>
                <Select value={bloomLevel} onValueChange={setBloomLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Belum ditentukan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Belum ditentukan</SelectItem>
                    {bloomLevels.map((b) => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tag</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const t = tagInput.trim();
                        if (t && !tags.includes(t)) setTags([...tags, t]);
                        setTagInput("");
                      }
                    }}
                    placeholder="Ketik tag lalu Enter (mis. hots, uts)"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const t = tagInput.trim();
                      if (t && !tags.includes(t)) setTags([...tags, t]);
                      setTagInput("");
                    }}
                  >
                    Tambah
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 px-2 py-0.5 rounded"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => setTags(tags.filter((x) => x !== t))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Preview */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Preview</h3>
            {isValid() ? (
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Siap simpan</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Belum lengkap</Badge>
            )}
          </div>
          <QuestionPreview
            type={type}
            content={content}
            mediaUrl={mediaUrl}
            options={choices}
            pairs={pairs}
            fillAnswer={fillAnswer}
            points={parseInt(points) || 1}
            difficulty={difficulty}
            showAnswers={showAnswers}
          />
        </div>
      </div>
    </div>
  );
}
