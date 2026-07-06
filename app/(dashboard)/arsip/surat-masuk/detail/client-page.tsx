"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, Send, User, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PDFViewer } from "@/components/arsip/pdf-viewer";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDate, normalizePublicPath } from "@/lib/utils";
import { goGet, goPost } from "@/lib/api-client";

interface Disposition {
    id: string;
    fromUser?: { fullName?: string; name?: string; role?: string };
    toUser?: { fullName?: string; name?: string; role?: string };
    instruction: string;
    isCompleted: boolean;
    createdAt: string;
    completedAt: string | null;
    completedNote: string | null;
}

interface SuratMasukDetail {
    id: string;
    agendaNumber: string;
    originalNumber: string;
    sender: string;
    subject: string;
    receivedAt: string;
    dateOfLetter: string;
    status: string;
    classification: { name: string; code: string } | null;
    filePath: string;
    notes: string | null;
    dispositions?: Disposition[];
}

export default function SuratMasukDetailPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [data, setData] = useState<SuratMasukDetail | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Disposition Form State
    const [isDisposisiOpen, setIsDisposisiOpen] = useState(false);
    const [userOptions, setUserOptions] = useState<{value: string, label: string}[]>([]);
    const [dispForm, setDispForm] = useState({
        toUserId: "",
        instruction: "",
        deadline: ""
    });
    const [submitting, setSubmitting] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const result: any = await goGet(`/api/arsip/surat-masuk/detail?id=${searchParams.get('id')}`);
            const payload = result.data || result;
            setData(payload ? { ...payload, dispositions: payload.dispositions || [] } : null);
        } catch (error) {
            console.error(error);
            toast.error("Gagal memuat surat");
        } finally {
            setLoading(false);
        }
    }, [searchParams.get('id')]);

    const loadUsers = useCallback(async () => {
        try {
            const result: any = await goGet("/api/users?limit=1000");
            const items = result.items || result.data?.items || result.data || result || [];
            setUserOptions(Array.isArray(items)
                ? items.map((user: any) => ({
                    value: user.id,
                    label: user.fullName || user.name || user.email || user.id
                }))
                : []);
        } catch (error) {
            console.error(error);
        }
    }, []);

    useEffect(() => {
        loadData();
        loadUsers();
    }, [loadData, loadUsers]);

    const handleDisposisi = async () => {
        if (!dispForm.toUserId || !dispForm.instruction) {
            toast.error("Mohon lengkapi tujuan dan instruksi");
            return;
        }

        setSubmitting(true);
        try {
            const res: any = await goPost("/api/arsip/disposisi", {
                suratMasukId: searchParams.get('id'),
                ...dispForm
            });

            if (res.error) throw new Error(res.error || "Gagal menyimpan disposisi");

            toast.success("Disposisi berhasil dikirim");
            setIsDisposisiOpen(false);
            setDispForm({ toUserId: "", instruction: "", deadline: "" });
            loadData(); // Reload to show new history
        } catch (error) {
            console.error(error);
            toast.error("Gagal mengirim disposisi");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center bg-muted animate-pulse rounded-xl h-96"></div>;
    if (!data) return <div className="p-8 text-center">Data tidak ditemukan</div>;

    const dispositions = data.dispositions || [];

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-2">
                    <Link href="/arsip/surat-masuk">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="p-0 h-auto text-muted-foreground hover:text-slate-900 dark:hover:text-white hover:bg-transparent -ml-1 flex items-center gap-1.5 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Kembali ke Surat Masuk
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            {data.agendaNumber}
                            <Badge variant="outline">{data.status}</Badge>
                        </h1>
                        <p className="text-muted-foreground text-sm flex items-center gap-2">
                            <span>Asal: {data.originalNumber}</span>
                            <span>•</span>
                            <span>{formatDate(data.receivedAt)}</span>
                        </p>
                    </div>
                </div>
                
                <Dialog open={isDisposisiOpen} onOpenChange={setIsDisposisiOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 bg-orange-600 hover:bg-orange-700">
                            <Send className="h-4 w-4" />
                            Disposisi
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Disposisi Surat</DialogTitle>
                            <DialogDescription>
                                Teruskan surat ini kepada staff/guru untuk ditindaklanjuti.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Diteruskan Kepada</Label>
                                <Select 
                                    value={dispForm.toUserId} 
                                    onValueChange={(val) => setDispForm({...dispForm, toUserId: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Staff / Guru" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {userOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Instruksi / Catatan</Label>
                                <Textarea 
                                    placeholder="Contoh: Mohon wakili saya untuk hadir..."
                                    rows={3}
                                    value={dispForm.instruction}
                                    onChange={(e) => setDispForm({...dispForm, instruction: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tenggat Waktu (Opsional)</Label>
                                <Input 
                                    type="date" 
                                    value={dispForm.deadline}
                                    onChange={(e) => setDispForm({...dispForm, deadline: e.target.value})}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDisposisiOpen(false)}>Batal</Button>
                            <Button onClick={handleDisposisi} disabled={submitting}>
                                {submitting ? "Mengirim..." : "Kirim Disposisi"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Content Split View */}
            <div className="grid lg:grid-cols-2 gap-6 h-full min-h-0">
                
                {/* Left: Details & History */}
                <div className="flex flex-col gap-6 h-full overflow-hidden">
                    <ScrollArea className="flex-1 pr-4">
                        <div className="space-y-6 pb-10">
                            {/* Meta Card */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base text-muted-foreground uppercase tracking-wide">Informasi Surat</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-lg leading-tight">{data.subject}</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Pengirim</p>
                                            <p className="font-medium">{data.sender}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Klasifikasi</p>
                                            <p className="font-medium">
                                                {data.classification ? `${data.classification.code} - ${data.classification.name}` : "-"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Tgl Surat</p>
                                            <p className="font-medium">{formatDate(data.dateOfLetter)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Tgl Terima</p>
                                            <p className="font-medium">{formatDate(data.receivedAt)}</p>
                                        </div>
                                    </div>
                                    {data.notes && (
                                        <div className="bg-muted p-3 rounded-lg text-sm italic">
                                            &quot;{data.notes}&quot;
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Disposition History */}
                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Riwayat Disposisi
                                </h3>
                                
                                {dispositions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">
                                        Belum ada disposisi untuk surat ini.
                                    </p>
                                ) : (
                                    <div className="space-y-4 relative pl-2">
                                        {/* History Timeline Line */}
                                        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border -z-10" />

                                        {dispositions.map((disp) => (
                                            <div key={disp.id} className="bg-card border rounded-lg p-4 ml-4 relative shadow-sm">
                                                {/* Dot */}
                                                <div className={`absolute -left-[25px] top-5 w-4 h-4 rounded-full border-2 border-background ${disp.isCompleted ? "bg-green-500" : "bg-orange-500"}`} />
                                                
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="font-semibold">{disp.fromUser?.fullName || disp.fromUser?.name || "-"}</span>
                                                        <span className="text-muted-foreground text-xs">-&gt;</span>
                                                        <span className="font-semibold text-blue-600">{disp.toUser?.fullName || disp.toUser?.name || "-"}</span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{formatDate(disp.createdAt)}</span>
                                                </div>
                                                
                                                <div className="bg-muted/50 p-3 rounded text-sm mb-3">
                                                    &quot;{disp.instruction}&quot;
                                                </div>

                                                {disp.isCompleted ? (
                                                    <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                                        <CheckCircle2 className="h-4 w-4 mt-0.5" />
                                                        <div>
                                                            <p className="font-medium">Selesai dikerjakan</p>
                                                            {disp.completedNote && <p className="text-xs mt-1">&quot;{disp.completedNote}&quot;</p>}
                                                            <p className="text-[10px] opacity-70 mt-1">{formatDate(disp.completedAt!)}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                                                        <Clock className="h-3 w-3" />
                                                        <span>Menunggu tindak lanjut</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                {/* Right: PDF Viewer */}
                <div className="h-full min-h-[500px] border-l pl-6 hidden lg:block">
                     <PDFViewer url={data.filePath} className="h-full shadow-lg" />
                </div>
                 {/* Mobile PDF Link shown only on small screens */}
                <div className="lg:hidden">
                    <Button variant="outline" className="w-full" onClick={() => window.open(normalizePublicPath(data.filePath), "_blank")}>
                        Lihat File PDF
                    </Button>
                </div>

            </div>
        </div>
    );
}


