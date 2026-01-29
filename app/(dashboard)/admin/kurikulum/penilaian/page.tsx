"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// ... imports

import { VisualGrading } from "@/components/dashboard/teacher/visual-grading";
import { useLayoutStore } from "@/lib/stores/layout-store";
import { Maximize2, Minimize2, FileSpreadsheet, LayoutGrid } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function PenilaianPage() {
    const { user } = useAuthStore();
    const { isZenMode, toggleZenMode } = useLayoutStore();
    
    const [tps, setTps] = useState<any[]>([]);
    const [selectedTp, setSelectedTp] = useState<string>("");
    
    const [students, setStudents] = useState<any[]>([]);
    // Refactored state: includes score and notes
    const [grades, setGrades] = useState<Record<string, { score: number, notes?: string }>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // View Mode State
    const [viewMode, setViewMode] = useState<"table" | "visual">("visual");

    useEffect(() => {
        if (user?.id) fetchTPs();
        fetchStudents();
    }, [user?.id]);

    const fetchStudents = async () => {
        const res = await fetch("/api/students");
        const json = await res.json();
        if (json.success) setStudents(json.data);
    };

    const fetchTPs = async () => {
        const res = await fetch(`/api/kurikulum/tp?teacherId=${user?.id}`);
        const json = await res.json();
        if (json.success) {
            setTps(json.data);
            if (json.data.length > 0) setSelectedTp(json.data[0].id);
        }
    };

    // Filter students based on selected TP's grade level
    const currentTp = tps.find(t => t.id === selectedTp);
    const filteredStudents = students.filter(s => {
        if (!currentTp) return true; // Show all if no TP selected
        // Match student class (e.g. "1A", "1") with TP grade (e.g. 1)
        // We check if student.className starts with the grade level
        return s.className ? s.className.startsWith(String(currentTp.gradeLevel)) : false;
    });

    const fetchGrades = async (tpId: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/kurikulum/grades?tpId=${tpId}`);
            const json = await res.json();
             if (json.success) {
                const map: Record<string, { score: number, notes?: string }> = {};
                json.data.forEach((g: any) => {
                    map[g.studentId] = { score: g.score, notes: g.notes };
                });
                setGrades(map);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedTp) fetchGrades(selectedTp);
    }, [selectedTp]);

    const handleScoreChange = (studentId: string, val: string | number) => {
        const numVal = typeof val === 'string' ? (val === "" ? 0 : parseInt(val)) : val;
        setGrades(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], score: numVal }
        }));
    };
    
    const handleNoteChange = (studentId: string, note: string) => {
        setGrades(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], score: prev[studentId]?.score || 0, notes: note }
        }));
    }

    const handleBulkFill = (score: number) => {
        if (!confirm(`Isi semua nilai kosong dengan ${score}?`)) return;
        setGrades(prev => {
            const next = { ...prev };
            filteredStudents.forEach(s => {
                if (!next[s.id] || !next[s.id].score) {
                    next[s.id] = { ...next[s.id], score: score };
                }
            });
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                tpId: selectedTp,
                grades: Object.entries(grades).map(([sid, data]) => ({
                    studentId: sid,
                    score: data.score,
                    notes: data.notes,
                    type: "FORMATIVE"
                }))
            };
            
            const res = await fetch("/api/kurikulum/grades", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) throw new Error("Failed");
            toast.success("Nilai berhasil disimpan");
        } catch(e) {
            toast.error("Gagal menyimpan nilai");
        } finally {
            setSaving(false);
        }
    };

    const getDescription = (score: number, tpContent?: string) => {
        if (!score) return "-";
        const content = tpContent || "materi ini";
        if (score >= 90) return `Sangat baik dalam ${content}.`;
        if (score >= 80) return `Baik dalam ${content}.`;
        if (score >= 70) return `Cukup menguasai ${content}.`;
        return `Perlu bimbingan dalam ${content}.`;
    };

    // Derived stats
    const gradedCount = filteredStudents.filter(s => grades[s.id]?.score > 0).length;
    const progress = filteredStudents.length ? Math.round((gradedCount / filteredStudents.length) * 100) : 0;


    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
                <div className="text-center md:text-left">
                  <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                    Buku Nilai
                  </h1>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Kelola penilaian formatif & sumatif kurikulum merdeka.
                  </p>
                  {isZenMode && <Badge variant="secondary" className="mt-2 animate-pulse bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Mode Fokus Aktif</Badge>}
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full border shadow-inner">
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setViewMode("table")}
                            className={`rounded-full px-4 h-8 transition-all duration-300 ${
                                viewMode === "table" 
                                ? 'bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400 font-bold' 
                                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                            }`}
                        >
                            <FileSpreadsheet className="w-4 h-4 mr-2" /> Tabel
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setViewMode("visual")}
                            className={`rounded-full px-4 h-8 transition-all duration-300 ${
                                viewMode === "visual" 
                                ? 'bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400 font-bold' 
                                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                            }`}
                        >
                            <LayoutGrid className="w-4 h-4 mr-2" /> Visual
                        </Button>
                    </div>

                    <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

                    <Button onClick={toggleZenMode} variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800" title={isZenMode ? "Keluar Fokus" : "Mode Fokus"}>
                        {isZenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>

                    <Button onClick={handleSave} disabled={saving} className="h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6 shadow-lg shadow-blue-600/20">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Simpan
                    </Button>
                </div>
            </div>

            {/* Main Controls Card */}
            <Card className="border-none shadow-xl bg-white dark:bg-zinc-900/50 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                <CardContent className="p-6 space-y-8"> 
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                         <div className="space-y-3">
                             <div className="flex items-center justify-between">
                                <Label className="text-base font-semibold">Tujuan Pembelajaran (TP)</Label>
                                {currentTp && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900">{currentTp.code}</Badge>}
                             </div>
                             <Select value={selectedTp} onValueChange={setSelectedTp}>
                                <SelectTrigger className="h-12 bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-blue-400 focus:ring-blue-500/20 transition-all rounded-xl">
                                    <SelectValue placeholder="Pilih TP yang dinilai..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {tps.map(tp => (
                                        <SelectItem key={tp.id} value={tp.id} className="py-3 border-b last:border-0 border-zinc-100 dark:border-zinc-800">
                                            <div className="flex flex-col items-start text-left gap-1">
                                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{tp.subject} <span className="font-normal text-muted-foreground ml-1">(Kelas {tp.gradeLevel})</span></span>
                                                <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed max-w-[400px]">{tp.content}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </div>

                        <div className="space-y-3">
                            <Label className="text-base font-semibold">Jenis Penilaian</Label>
                            <Select defaultValue="FORMATIVE">
                                <SelectTrigger className="h-12 bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="FORMATIVE">Formatif (Tujuan Pembelajaran)</SelectItem>
                                    <SelectItem value="SUMMATIVE">Sumatif Lingkup Materi</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {currentTp && (
                        <div className="mt-4 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 animate-in fade-in slide-in-from-bottom-2">
                            <p className="font-medium text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-2">
                                <Sparkles className="h-4 w-4" /> Detail Kompetensi
                            </p>
                            {currentTp.content}
                        </div>
                     )}
                        
                    {/* Progress Panel */}
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                        <div className="flex justify-between items-end mb-3">
                            <div>
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Cakupan Siswa</div>
                                <div className="text-2xl font-bold text-zinc-900 dark:text-white flex items-baseline gap-1">
                                    {filteredStudents.length} <span className="text-sm font-normal text-muted-foreground">Siswa</span>
                                    {filteredStudents.length > 0 && <span className="text-xs font-normal text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full ml-2">Kelas {currentTp?.gradeLevel}</span>}
                                </div>
                            </div>
                            <div className="text-right">
                                    <div className="text-xs font-medium text-muted-foreground mb-1">Progress</div>
                                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{Math.round(progress)}%</div>
                            </div>
                        </div>
                        <div className="h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex gap-2 mt-4 justify-end">
                            <Button variant="outline" size="sm" onClick={() => handleBulkFill(80)} className="h-7 text-xs bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:text-blue-600">Set Rata 80</Button>
                            <Button variant="outline" size="sm" onClick={() => handleBulkFill(100)} className="h-7 text-xs bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:text-blue-600">Set Rata 100</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Separator for Visual Mode */}
             {viewMode === "visual" && (
                <div className="flex items-center gap-3 mb-2 animate-in fade-in slide-in-from-bottom-3 px-1">
                     <div className="h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent flex-1" />
                     <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Penilaian Visual</span>
                     <div className="h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent flex-1" />
                </div>
            )}

            {viewMode === "visual" ? (
                <VisualGrading 
                    students={filteredStudents} 
                    grades={grades} 
                    onGradeChange={handleScoreChange}
                    onNoteChange={handleNoteChange} 
                />
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">No</TableHead>
                                    <TableHead className="w-[200px]">Nama Siswa</TableHead>
                                    <TableHead className="w-[120px]">
                                        Nilai (0-100)
                                    </TableHead>
                                    <TableHead className="w-[200px]">Catatan Anekdotal</TableHead>
                                    <TableHead>Deskripsi Rapor (Otomatis)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.map((s, i) => {
                                    const gradeData = grades[s.id] || { score: 0, notes: "" };
                                    const score = gradeData.score || "";
                                    const currentTp = tps.find(t => t.id === selectedTp);
                                    
                                    return (
                                        <TableRow key={s.id}>
                                            <TableCell>{i + 1}</TableCell>
                                            <TableCell className="font-medium">{s.namaLengkap || s.nama}</TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    min="0" 
                                                    max="100" 
                                                    className="w-20 font-mono font-bold"
                                                    value={score}
                                                    onChange={e => handleScoreChange(s.id, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === "ArrowDown") {
                                                            e.preventDefault();
                                                            const inputs = document.querySelectorAll('input[type="number"]');
                                                            const index = Array.from(inputs).indexOf(e.currentTarget as HTMLInputElement);
                                                            if (index < inputs.length - 1) {
                                                                (inputs[index + 1] as HTMLInputElement).focus();
                                                            }
                                                        }
                                                        if (e.key === "ArrowUp") {
                                                            e.preventDefault();
                                                            const inputs = document.querySelectorAll('input[type="number"]');
                                                            const index = Array.from(inputs).indexOf(e.currentTarget as HTMLInputElement);
                                                            if (index > 0) {
                                                                (inputs[index - 1] as HTMLInputElement).focus();
                                                            }
                                                        }
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    placeholder="Tulis catatan kecil..." 
                                                    className="text-xs"
                                                    value={gradeData.notes || ""}
                                                    onChange={e => handleNoteChange(s.id, e.target.value)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm italic">
                                                {score ? (
                                                    <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 animate-in fade-in">
                                                        <Sparkles className="h-3 w-3 text-yellow-500" />
                                                        {getDescription(Number(score), currentTp?.content)}
                                                    </div>
                                                ) : "-"}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
