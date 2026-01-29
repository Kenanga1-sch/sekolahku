"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Vault, Landmark, Plus, Pencil, UserCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { showSuccess, showError } from "@/lib/toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import LoanManager from "@/components/loans/loan-manager";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

interface Brankas {
    id: string;
    nama: string;
    saldo: number;
    picId?: string;
    pic?: {
        name: string;
        role: string;
    };
}

interface UserOption {
    id: string;
    name: string;
    role: string;
}

export default function TabunganBrankasPage() {
    const [brankasList, setBrankasList] = useState<Brankas[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Brankas | null>(null);
    const [formData, setFormData] = useState({ nama: "", saldo: 0 });
    const [isSaving, setIsSaving] = useState(false);

    // Placeholder data for debt/accounting
    // In future this will be fetched from API
    const [activeTab, setActiveTab] = useState("overview");

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Brankas
            const res = await fetch("/api/tabungan/brankas");
            const data = await res.json();
            if (data.data) {
                setBrankasList(Array.isArray(data.data) ? data.data : [data.data]);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            showError("Gagal memuat data");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenDialog = (item?: Brankas) => {
        if (item) {
            setEditingItem(item);
            setFormData({ nama: item.nama, saldo: item.saldo });
        } else {
            setEditingItem(null);
            setFormData({ nama: "", saldo: 0 });
        }
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            const payload = {
                id: editingItem?.id,
                nama: formData.nama,
                // Only allow setting saldo on creation or separate adjustment? 
                // For now allow initial saldo.
                saldo: editingItem ? undefined : formData.saldo 
            };

            const res = await fetch("/api/tabungan/brankas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if(!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error("Save Error:", errData);
                throw new Error(errData.error || "Gagal menyimpan data");
            }
            
            showSuccess("Data brankas berhasil disimpan");
            setIsDialogOpen(false);
            fetchData();
        } catch (error: any) {
            showError(error.message || "Gagal menyimpan data");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/tabungan">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Pembukuan & Brankas</h1>
                        <p className="text-muted-foreground">
                            Pusat pencatatan keuangan, arus kas, dan manajemen aset tabungan.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh Data
                    </Button>
                    {activeTab === "overview" && (
                        <Button onClick={() => handleOpenDialog()}>
                            <Plus className="h-4 w-4 mr-2" />
                            Tambah Akun/Brankas
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex gap-4 border-b">
                 <button 
                    onClick={() => setActiveTab("overview")}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                 >
                    Daftar Brankas
                 </button>
                 <button 
                    onClick={() => setActiveTab("hutang")}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "hutang" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                 >
                    Hutang Pegawai
                 </button>
                 <button 
                    onClick={() => setActiveTab("mutasi")}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === "mutasi" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                 >
                    Mutasi & Arus Kas
                 </button>
            </div>

            {activeTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        Array.from({length: 3}).map((_, i) => (
                            <Skeleton key={i} className="h-40 w-full rounded-xl" />
                        ))
                    ) : brankasList.length === 0 ? (
                        <Card className="col-span-full p-8 text-center text-muted-foreground">
                            Belum ada data brankas/rekening. Tambahkan sekarang.
                        </Card>
                    ) : (
                        brankasList.map((item) => (
                            <Card key={item.id} className="relative overflow-hidden group">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            {item.nama.toLowerCase().includes("bank") ? <Landmark className="h-5 w-5" /> : <Vault className="h-5 w-5" />}
                                            {item.nama}
                                        </CardTitle>
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <CardDescription>
                                        Saldo Tersedia
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold mb-4">
                                        {formatRupiah(item.saldo)}
                                    </div>
                                    
                                    {item.pic && (
                                        <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3">
                                            <div className="bg-primary/10 p-2 rounded-full">
                                                <UserCircle className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">PIC / Bendahara</div>
                                                <div className="text-sm font-medium">
                                                    {item.pic.name}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

// LoanManager imported at top level

// ...

            {activeTab === "hutang" && (
                <LoanManager />
            )}
            
            {activeTab === "mutasi" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Mutasi & Arus Kas</CardTitle>
                        <CardDescription>
                            Riwayat perpindahan uang antar brankas dan setoran masuk akan muncul di sini.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[200px] flex items-center justify-center border-t bg-muted/10">
                        <p className="text-muted-foreground text-sm italic">
                            Modul Laporan Mutasi siap digunakan setelah fitur Hutang aktif.
                        </p>
                    </CardContent>
                </Card>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem ? "Edit Nama Akun" : "Tambah Akun Keuangan Baru"}</DialogTitle>
                        <DialogDescription>
                            {editingItem 
                                ? "Ubah nama brankas atau rekening bank ini." 
                                : "Buat akun penyimpanan baru (fisik atau bank)."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="nama">Nama Akun / Brankas</Label>
                            <Input 
                                id="nama" 
                                value={formData.nama} 
                                onChange={(e) => setFormData({...formData, nama: e.target.value})}
                                placeholder="Contoh: Kas Besar, Bank BNI, Kas Kecil"
                            />
                        </div>
                        {!editingItem && (
                             <div className="grid gap-2">
                                <Label htmlFor="saldo">Saldo Awal (Rp)</Label>
                                <Input 
                                    id="saldo" 
                                    type="number"
                                    min="0"
                                    value={formData.saldo} 
                                    onChange={(e) => setFormData({...formData, saldo: parseFloat(e.target.value) || 0})}
                                />
                                <p className="text-xs text-muted-foreground">Saldo hanya bisa diset saat pembuatan awal.</p>
                            </div>
                        )}
                        <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                             Untuk mengatur Bendahara (PIC), silakan gunakan menu <strong>Kelola Pengguna</strong>.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={isSaving || !formData.nama}>
                            {isSaving ? "Menyimpan..." : "Simpan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
