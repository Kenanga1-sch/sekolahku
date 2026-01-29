"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function CreateSuratKeluarPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        recipient: "",
        subject: "",
        dateOfLetter: new Date().toISOString().split("T")[0],
        classificationCode: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.classificationCode) {
            toast.error("Mohon isi Kode Klasifikasi untuk generate nomor");
            return;
        }

        setLoading(true);
        
        try {
            const res = await fetch("/api/arsip/surat-keluar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error("Gagal booking nomor surat");

            const result = await res.json();
            toast.success(`Nomor Surat Dibooking: ${result.mailNumber}`);
            
            // Redirect to detail page to view number and upload later
            router.push(`/arsip/surat-keluar/${result.id}`);
        } catch (error) {
            console.error(error);
            toast.error("Terjadi kesalahan saat menyimpan");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/arsip/surat-keluar">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Booking Nomor Surat</h1>
                    <p className="text-muted-foreground text-sm">Buat draft baru dan dapatkan nomor urut otomatis</p>
                </div>
            </div>

            <Card className="border-green-200 shadow-lg shadow-green-100 dark:shadow-none dark:border-green-900">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BookmarkPlus className="h-5 w-5 text-green-600" />
                        Form Surat Keluar
                    </CardTitle>
                    <CardDescription>
                        Isi form ini sebelum mencetak surat untuk mendapatkan nomor referensi.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-100 dark:border-green-900/20 text-sm mb-6">
                            <p className="font-semibold text-green-800 dark:text-green-400 mb-1">💡 Info Nomor Surat</p>
                            <p className="text-green-700 dark:text-green-500">
                                Nomor surat akan digenerate otomatis dengan format: <br/>
                                <code className="bg-white dark:bg-black px-1 rounded border border-green-200 dark:border-green-800 mt-1 inline-block">
                                    [Kode]/[No.Urut]-SD/[BulanRomawi]/[Tahun]
                                </code>
                            </p>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Kode Klasifikasi *</Label>
                                <Input 
                                    placeholder="Contoh: 421.2"
                                    value={formData.classificationCode}
                                    onChange={e => setFormData({...formData, classificationCode: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tanggal Surat *</Label>
                                <Input 
                                    type="date"
                                    value={formData.dateOfLetter}
                                    onChange={e => setFormData({...formData, dateOfLetter: e.target.value})}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Tujuan Kepada *</Label>
                            <Input 
                                placeholder="Penerima Surat (Instansi/Perorangan)"
                                value={formData.recipient}
                                onChange={e => setFormData({...formData, recipient: e.target.value})}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Perihal *</Label>
                            <Textarea 
                                placeholder="Isi perihal surat..."
                                rows={3}
                                value={formData.subject}
                                onChange={e => setFormData({...formData, subject: e.target.value})}
                                required
                            />
                        </div>

                        <div className="pt-4">
                            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 h-11" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Memproses...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Simpan & Generate Nomor
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
