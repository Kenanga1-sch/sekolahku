"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Clock, ChevronLeft, Save, Loader2, Printer } from "lucide-react";
import { SMART_SNIPPETS } from "@/lib/constants/snippets";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

export default function ModulAjarEditor() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get("id");
    const { user } = useAuthStore();
    
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
    const [existingModules, setExistingModules] = useState<any[]>([]);
    
    const [tps, setTps] = useState<any[]>([]);
    
    const [formData, setFormData] = useState({
        tpId: "",
        topic: "",
        activities: {
            opening: "",
            core: "",
            closing: ""
        },
        allocationMap: {
            opening: 10,
            core: 50,
            closing: 10
        },
        assessmentPlan: "",
        status: "DRAFT"
    });

    useEffect(() => {
        if (user?.id) {
            fetchTPs();
        }
    }, [user?.id]);

    useEffect(() => {
        if (id) {
            fetchModuleData(id);
        }
    }, [id]);

    const fetchTPs = async () => {
        const res = await fetch(`/api/kurikulum/tp?teacherId=${user?.id}`);
        const json = await res.json();
        if (json.success) setTps(json.data);
    };

    const fetchModuleData = async (moduleId: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/kurikulum/modules/${moduleId}`);
            const json = await res.json();
            if (json.success) {
                const d = json.data;
                setFormData({
                    tpId: d.tpId,
                    topic: d.topic,
                    activities: typeof d.activities === 'string' ? JSON.parse(d.activities) : d.activities,
                    allocationMap: d.allocationMap ? (typeof d.allocationMap === 'string' ? JSON.parse(d.allocationMap) : d.allocationMap) : { opening: 10, core: 50, closing: 10 },
                    assessmentPlan: d.assessmentPlan || "",
                    status: d.status
                });
            }
        } catch (e) {
            toast.error("Gagal memuat modul");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const endpoint = id ? `/api/kurikulum/modules/${id}` : "/api/kurikulum/modules";
            const method = id ? "PUT" : "POST";
            
            const payload = {
                ...formData,
                activities: formData.activities // API should handle JSON stringification if needed, mostly body parser does it
            };

            const res = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed");
            
            toast.success("Modul Ajar tersimpan!");
            router.push("/admin/kurikulum/perencanaan");
        } catch (e) {
            toast.error("Gagal menyimpan modul");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const fetchExistingModules = async () => {
        if (existingModules.length > 0) {
            setIsCopyDialogOpen(true);
            return;
        }
        try {
            const res = await fetch(`/api/kurikulum/modules?teacherId=${user?.id}`);
            const json = await res.json();
            if (json.success) {
                setExistingModules(json.data);
                setIsCopyDialogOpen(true);
            }
        } catch (e) {
            toast.error("Gagal memuat daftar modul");
        }
    };

    const handleCopyModule = async (moduleId: string) => {
        try {
            const res = await fetch(`/api/kurikulum/modules/${moduleId}`);
            const json = await res.json();
            if (json.success) {
                const d = json.data;
                // Copy activities but keep tpId and topic if already set? 
                // Usually user wants full copy.
                setFormData(prev => ({
                    ...prev,
                    activities: typeof d.activities === 'string' ? JSON.parse(d.activities) : d.activities,
                    allocationMap: d.allocationMap ? (typeof d.allocationMap === 'string' ? JSON.parse(d.allocationMap) : d.allocationMap) : { opening: 10, core: 50, closing: 10 },
                    assessmentPlan: d.assessmentPlan || "",
                }));
                toast.success("Isi modul berhasil disalin!");
                setIsCopyDialogOpen(false);
            }
        } catch (e) {
            toast.error("Gagal menyalin modul");
        }
    };

    const insertSnippet = (section: 'opening' | 'core' | 'closing', text: string) => {
        const current = formData.activities[section];
        const newText = current ? current + "\n" + text : text;
        setFormData({
            ...formData,
            activities: {
                ...formData.activities,
                [section]: newText
            }
        });
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-4 mb-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{id ? "Edit Modul Ajar" : "Buat Modul Ajar"}</h1>
                    <p className="text-muted-foreground">Rancang kegiatan pembelajaran terstruktur.</p>
                </div>
                <div className="ml-auto flex gap-2">
                    <Button variant="outline" onClick={fetchExistingModules}>
                        <Copy className="mr-2 h-4 w-4" /> Salin Modul Lain
                    </Button>
                    {id && (
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" /> Cetak PDF
                        </Button>
                    )}
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Simpan Modul
                    </Button>
                </div>
            </div>

            <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Salin dari Modul Lain</DialogTitle>
                        <DialogDescription>Pilih modul sebelumnya untuk menyalin isi kegiatan.</DialogDescription>
                    </DialogHeader>
                    <div className="h-[300px] overflow-y-auto space-y-2">
                        {existingModules.map(m => (
                            <div key={m.id} className="p-3 border rounded hover:bg-zinc-50 cursor-pointer flex justify-between items-center" onClick={() => handleCopyModule(m.id)}>
                                <div>
                                    <div className="font-medium text-sm">{m.topic}</div>
                                    <div className="text-xs text-muted-foreground">{m.subject} - Kelas {m.grade}</div>
                                </div>
                                <Button size="sm" variant="ghost">Pilih</Button>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Informasi Umum</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Tujuan Pembelajaran (TP)</Label>
                                <Select value={formData.tpId} onValueChange={(v) => setFormData({...formData, tpId: v})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Tujuan Pembelajaran..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tps.length === 0 ? (
                                            <div className="p-2 text-xs text-muted-foreground text-center">
                                                Anda belum memiliki data TP. Silakan susun TP di menu Perencanaan.
                                            </div>
                                        ) : (
                                            tps.map(tp => (
                                                <SelectItem key={tp.id} value={tp.id}>
                                                    <span className="font-bold mr-2">{tp.code}</span> 
                                                    {tp.subject} - {tp.content.substring(0, 50)}...
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Topik / Materi Pokok</Label>
                                <Input 
                                    placeholder="Contoh: Operasi Penjumlahan Bilangan Cacah" 
                                    value={formData.topic}
                                    onChange={(e) => setFormData({...formData, topic: e.target.value})}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Kegiatan Pembelajaran</CardTitle>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                                <Clock className="h-4 w-4" />
                                <span>Total: {Object.values(formData.allocationMap).reduce((a,b) => a+b, 0)} menit</span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {(['opening', 'core', 'closing'] as const).map((section, idx) => {
                                const titles = { opening: "1. Kegiatan Awal", core: "2. Kegiatan Inti", closing: "3. Kegiatan Penutup" };
                                const colors = { opening: "text-blue-600", core: "text-blue-600", closing: "text-blue-600" };
                                
                                return (
                                    <div key={section} className="space-y-2">
                                        <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 p-2 rounded border">
                                            <Label className={`${colors[section]} font-bold`}>{titles[section]}</Label>
                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs">Durasi (menit)</Label>
                                                <Input 
                                                    type="number" 
                                                    className="w-16 h-8 text-right"
                                                    value={formData.allocationMap[section]}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        allocationMap: { ...formData.allocationMap, [section]: parseInt(e.target.value) || 0 }
                                                    })}
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* Smart Snippets */}
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {SMART_SNIPPETS[section].map((text, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    className="text-[10px] bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-2 py-1 rounded border transition"
                                                    onClick={() => insertSnippet(section, text)}
                                                >
                                                    + {text.length > 20 ? text.substring(0, 20) + "..." : text}
                                                </button>
                                            ))}
                                        </div>

                                        <Textarea 
                                            className={section === 'core' ? "min-h-[200px]" : "min-h-[100px]"}
                                            placeholder={`Deskripsi ${titles[section]}...`}
                                            value={formData.activities[section]}
                                            onChange={(e) => setFormData({
                                                ...formData, 
                                                activities: { ...formData.activities, [section]: e.target.value }
                                            })}
                                        />
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                     <Card>
                        <CardHeader><CardTitle>Asesmen</CardTitle></CardHeader>
                        <CardContent>
                            <Label>Rencana Penilaian</Label>
                            <Textarea 
                                className="h-32 mt-2" 
                                placeholder="Jenis asesmen: Formatif (Observasi)..."
                                value={formData.assessmentPlan}
                                onChange={(e) => setFormData({...formData, assessmentPlan: e.target.value})}
                            />
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader><CardTitle>Status Publish</CardTitle></CardHeader>
                        <CardContent>
                            <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DRAFT">Draft (Konsep)</SelectItem>
                                    <SelectItem value="PUBLISHED">Published (Final)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-2">
                                Modul yang dipublish dapat dilihat oleh Kepala Sekolah.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
