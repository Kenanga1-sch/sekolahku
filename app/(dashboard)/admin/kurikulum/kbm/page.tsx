"use client";

import { useState, useEffect } from "react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { id } from "date-fns/locale";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLayoutStore } from "@/lib/stores/layout-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon, Clock, BookOpen, Plus, Save, Loader2, ChevronLeft, ChevronRight, MoreVertical, Search, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function KbmPage() {
    const { user } = useAuthStore();
    const { isZenMode } = useLayoutStore();
    
    const [journals, setJournals] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    
    // Date Navigation
    const [selectedDate, setSelectedDate] = useState(new Date());
    
    // Form State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [tps, setTps] = useState<any[]>([]);
    const [newJournal, setNewJournal] = useState({
        date: new Date().toISOString().split('T')[0],
        className: "",
        subject: "Matematika",
        tpIds: [] as string[],
        notes: ""
    });



    const fetchJournals = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/kurikulum/journals?teacherId=${user?.id}`);
            const json = await res.json();
            if (json.success) setJournals(json.data);
        } finally {
            setLoading(false);
        }
    };

    const fetchTPs = async () => {
        const res = await fetch(`/api/kurikulum/tp?teacherId=${user?.id}`);
        const json = await res.json();
        if (json.success) setTps(json.data);
    };

    useEffect(() => {
        setMounted(true);
        if (user?.id) {
            fetchJournals();
            fetchTPs();
        }
    }, [user?.id]);

    if (!mounted) return null; 



    const handleCreate = async () => {
        if (!newJournal.className) {
            toast.error("Pilih kelas dulu");
            return;
        }

        try {
            const res = await fetch("/api/kurikulum/journals", {
                method: "POST",
                body: JSON.stringify({
                    ...newJournal,
                    teacherId: user?.id,
                    studentAttendance: [] 
                })
            });
            
            if (!res.ok) throw new Error("Failed");
            
            toast.success("Jurnal tersimpan!");
            setIsDialogOpen(false);
            fetchJournals();
            // Reset but keep date
            setNewJournal(prev => ({
                ...prev,
                className: "",
                tpIds: [],
                notes: ""
            }));
        } catch (e) {
            toast.error("Gagal simpan jurnal");
        }
    };

    const toggleTp = (tpId: string) => {
        setNewJournal(prev => {
            if (prev.tpIds.includes(tpId)) {
                return { ...prev, tpIds: prev.tpIds.filter(id => id !== tpId) };
            } else {
                return { ...prev, tpIds: [...prev.tpIds, tpId] };
            }
        });
    };
    
    const filteredJournals = journals.filter(j => isSameDay(new Date(j.date), selectedDate));
    const sortedJournals = filteredJournals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Generate days for selector (current week mostly)
    const days = [];
    for (let i = -3; i <= 3; i++) {
        days.push(addDays(selectedDate, i));
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
             <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    Jurnal Mengajar
                    {isZenMode && <Badge variant="secondary" className="animate-pulse">Mode Fokus</Badge>}
                  </h1>
                  <p className="text-muted-foreground">
                    Catat agenda pembelajaran dan presensi kelas.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setSelectedDate(new Date())}>Hari Ini</Button>
                    <Button onClick={() => {
                        setNewJournal(prev => ({...prev, date: format(selectedDate, 'yyyy-MM-dd')}));
                        setIsDialogOpen(true)
                    }}>
                        <Plus className="mr-2 h-4 w-4" /> Catat Jurnal
                    </Button>
                </div>
            </div>

            {/* Date Selector */}
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <Button variant="ghost" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 7))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex flex-1 justify-center gap-2 overflow-x-auto overflow-y-hidden pb-2 md:pb-0 scrollbar-hide">
                    {days.map((date, i) => {
                        const isSelected = isSameDay(date, selectedDate);
                        return (
                            <button
                                key={i}
                                onClick={() => setSelectedDate(date)}
                                className={cn(
                                    "flex flex-col items-center justify-center min-w-[3.5rem] h-16 rounded-xl transition-all duration-200",
                                    isSelected 
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105" 
                                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <span className="text-[10px] uppercase font-bold">{format(date, "EEE", { locale: id })}</span>
                                <span className="text-xl font-bold">{format(date, "d")}</span>
                            </button>
                        )
                    })}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 mt-6">
                {/* Timeline Section */}
                <Card className="lg:col-span-2 border-none shadow-none bg-transparent">
                    <CardHeader>
                        <CardTitle className="text-lg">Timeline Aktivitas</CardTitle>
                        <CardDescription>{format(selectedDate, "eeee, d MMMM yyyy", { locale: id })}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>
                        ) : sortedJournals.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed">
                                <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                                    <BookOpen className="h-8 w-8 text-blue-500" />
                                </div>
                                <h3 className="text-lg font-bold">Belum ada jurnal</h3>
                                <p className="text-muted-foreground text-center max-w-xs mb-6">
                                    Belum ada aktivitas mengajar yang tercatat pada tanggal ini.
                                </p>
                                <Button onClick={() => setIsDialogOpen(true)} variant="secondary">
                                    <Plus className="mr-2 h-4 w-4" /> Buat Jurnal Baru
                                </Button>
                            </div>
                        ) : (
                            <div className="relative pl-8 space-y-8 before:absolute before:inset-y-0 before:left-3 before:w-[2px] before:bg-zinc-200 dark:before:bg-zinc-800">
                                {sortedJournals.map((j, idx) => (
                                    <div key={j.id} className="relative animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                        <div className="absolute -left-8 top-1 h-6 w-6 rounded-full border-4 border-white dark:border-zinc-950 bg-blue-600 shadow-sm z-10" />
                                        
                                        <div className="group bg-white dark:bg-zinc-900 border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-blue-200 dark:hover:border-blue-900">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 border-none">
                                                        Kelas {j.className}
                                                    </Badge>
                                                    <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                                                        {j.subject}
                                                    </span>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            
                                            <h4 className="text-lg font-bold mb-2">Jurnal Pembelajaran</h4>
                                            
                                            {j.notes && (
                                                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 italic mb-4 border border-zinc-100 dark:border-zinc-800">
                                                    "{j.notes}"
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-2 mt-4">
                                                <div className="flex items-center text-xs text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                                                    <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                                                    {j.tpIds?.length || 0} TP Tercapai
                                                </div>
                                                <div className="flex items-center text-xs text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                                                     <Clock className="h-3 w-3 mr-1 text-orange-500" />
                                                     2 JP (Jam Pelajaran)
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Right Sidebar Stats */}
                <div className="space-y-6">
                    <Card className="bg-gradient-to-br from-blue-600 to-indigo-600 border-none text-white shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-white/90">Ringkasan Bulan Ini</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 text-center">
                            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                                <p className="text-3xl font-bold">{journals.length}</p>
                                <p className="text-xs text-blue-100 mt-1">Total Pertemuan</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                                <p className="text-3xl font-bold">{tps.length}</p>
                                <p className="text-xs text-blue-100 mt-1">Target TP</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                             <CardTitle className="text-base">Mata Pelajaran Aktif</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {["Matematika", "Bahasa Indonesia", "IPAS", "Seni Budaya", "PJOK", "Pendidikan Pancasila", "Bahasa Inggris", "Bahasa Indramayu", "Budi Pekerti", "Koding dan Kecerdasan Artifisial"].map((mapel, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => {
                                            setNewJournal(prev => ({...prev, subject: mapel, date: format(selectedDate, 'yyyy-MM-dd')}));
                                            setIsDialogOpen(true);
                                        }}
                                        className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-8 w-8 rounded-lg flex items-center justify-center",
                                                idx % 4 === 0 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : 
                                                idx % 4 === 1 ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 
                                                idx % 4 === 2 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' :
                                                'bg-purple-100 text-purple-600 dark:bg-purple-900/30'
                                            )}>
                                                <span className="font-bold text-xs">{mapel.substring(0,1)}</span>
                                            </div>
                                            <span className="text-sm font-medium">{mapel}</span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Jurnal Mengajar Baru</DialogTitle>
                        <DialogDescription>
                            {format(new Date(newJournal.date), "eeee, d MMMM yyyy", { locale: id })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Kelas</Label>
                                <Select value={newJournal.className} onValueChange={v => setNewJournal({...newJournal, className: v})}>
                                    <SelectTrigger className="h-12"><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                                    <SelectContent>
                                        {["1", "2", "3", "4", "5", "6"].map(c => (
                                            <SelectItem key={c} value={c}>Kelas {c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Mata Pelajaran</Label>
                                <Select value={newJournal.subject} onValueChange={v => setNewJournal({...newJournal, subject: v, tpIds: []})}>
                                    <SelectTrigger className="h-12"><SelectValue placeholder="Pilih Mapel" /></SelectTrigger>
                                    <SelectContent>
                                        {["Matematika", "Bahasa Indonesia", "IPAS", "Seni Budaya", "PJOK", "Pendidikan Pancasila", "Bahasa Inggris", "Bahasa Indramayu", "Budi Pekerti", "Koding dan Kecerdasan Artifisial"].map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                         <div className="space-y-2">
                            <Label className="flex justify-between">
                                <span>Capaian Pembelajaran (TP)</span>
                                <span className="text-xs text-muted-foreground">{newJournal.tpIds.length} dipilih</span>
                            </Label>
                            <ScrollArea className="h-[200px] border rounded-lg p-3 bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800">
                                {tps.filter(tp => tp.subject === newJournal.subject).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                        <p className="text-sm">Belum ada data TP untuk {newJournal.subject}.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {tps
                                            .filter(tp => tp.subject === newJournal.subject)
                                            .map(tp => (
                                            <div 
                                                key={tp.id} 
                                                className={cn(
                                                    "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                                                    newJournal.tpIds.includes(tp.id) 
                                                        ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                                                        : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700"
                                                )}
                                                onClick={() => toggleTp(tp.id)}
                                            >
                                                <div className={cn(
                                                    "mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center flex-shrink-0",
                                                    newJournal.tpIds.includes(tp.id) ? "bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500" : "border-zinc-400 dark:border-zinc-500"
                                                )}>
                                                    {newJournal.tpIds.includes(tp.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                </div>
                                                <div className="text-sm leading-relaxed dark:text-zinc-200">
                                                    <span className="font-bold text-blue-600 dark:text-blue-400 mr-2">{tp.code}</span>
                                                    {tp.content}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>

                        <div className="space-y-2">
                            <Label>Catatan Refleksi</Label>
                            <Textarea 
                                placeholder="Bagaimana proses pembelajaran hari ini? Apakah ada siswa yang perlu perhatian khusus?" 
                                className="min-h-[100px] resize-none"
                                value={newJournal.notes}
                                onChange={e => setNewJournal({...newJournal, notes: e.target.value})}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                         <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="h-11">Batal</Button>
                         <Button onClick={handleCreate} className="h-11 px-8">Simpan Jurnal</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
