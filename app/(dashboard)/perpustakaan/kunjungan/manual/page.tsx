"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, UserCheck, Users, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AsyncSelect from "react-select/async";
import { goGet, goPost } from "@/lib/api-client";

export default function ManualVisitPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    
    // Member State
    const [selectedMember, setSelectedMember] = useState<any>(null);

    // Guest State
    const [guestName, setGuestName] = useState("");
    const [institution, setInstitution] = useState("");
    const [purpose, setPurpose] = useState("");

    // Load Members for Select
    const loadOptions = async (inputValue: string) => {
        if (!inputValue) return [];
        try {
            const data: any = await goGet(`/api/library/members?search=${inputValue}`);
            return data.items.map((m: any) => ({
                value: m.id,
                label: `${m.name} (${m.className || "Umum"}) - ${m.qrCode}`,
                member: m
            }));
        } catch (error) {
            console.error("Failed to load members", error);
            return [];
        }
    };

    const handleSubmit = async (type: "member" | "guest") => {
        setLoading(true);
        try {
            const payload: any = {};
            
            if (type === "member") {
                if (!selectedMember) {
                    toast.error("Pilih anggota terlebih dahulu");
                    setLoading(false);
                    return;
                }
                payload.memberId = selectedMember.value;
            } else {
                if (!guestName) {
                    toast.error("Nama tamu wajib diisi");
                    setLoading(false);
                    return;
                }
                payload.guestName = guestName;
                payload.institution = institution;
                payload.purpose = purpose;
            }

            const result: any = await goPost("/api/library/visits/manual", payload);

            if (result.success || !result.error) {
                toast.success("Kunjungan berhasil dicatat!");
                // Reset Forms
                setSelectedMember(null);
                setGuestName("");
                setInstitution("");
                setPurpose("");
            } else {
                toast.error(result.error || "Gagal mencatat kunjungan");
            }

        } catch (error) {
            toast.error("Terjadi kesalahan sistem");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto py-8">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Catat Kunjungan Manual</h1>
                    <p className="text-muted-foreground">Formulir pencatatan kunjungan harian jika Kiosk tidak tersedia</p>
                </div>
            </div>

            <Tabs defaultValue="member" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="member" className="gap-2">
                        <Users className="h-4 w-4" />
                        Anggota Sekolah
                    </TabsTrigger>
                    <TabsTrigger value="guest" className="gap-2">
                        <User className="h-4 w-4" />
                        Tamu Luar
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="member">
                    <Card>
                        <CardHeader>
                            <CardTitle>Kunjungan Anggota</CardTitle>
                            <CardDescription>
                                Cari siswa atau staf yang sudah terdaftar sebagai anggota perpustakaan.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Cari Anggota</Label>
                                <AsyncSelect
                                    cacheOptions
                                    loadOptions={loadOptions}
                                    defaultOptions
                                    placeholder="Ketik nama, kelas, atau QR Code..."
                                    onChange={setSelectedMember}
                                    value={selectedMember}
                                    classNames={{
                                        control: () => "border border-input bg-background rounded-md px-1",
                                        input: () => "text-sm",
                                        option: () => "text-sm"
                                    }}
                                />
                                <p className="text-[12px] text-muted-foreground">
                                    Pilih nama dari hasil pencarian.
                                </p>
                            </div>

                            <Button 
                                className="w-full" 
                                size="lg" 
                                onClick={() => handleSubmit("member")}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                Catat Kunjungan
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="guest">
                    <Card>
                        <CardHeader>
                            <CardTitle>Kunjungan Tamu</CardTitle>
                            <CardDescription>
                                Input manual untuk tamu, orang tua, atau pengunjung luar yang tidak memiliki kartu.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nama Lengkap <span className="text-red-500">*</span></Label>
                                <Input 
                                    placeholder="Contoh: Bpk. Budi Santoso" 
                                    value={guestName}
                                    onChange={(e) => setGuestName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Instansi / Asal (Opsional)</Label>
                                <Input 
                                    placeholder="Contoh: Dinas Pendidikan / Wali Murid" 
                                    value={institution}
                                    onChange={(e) => setInstitution(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Keperluan (Opsional)</Label>
                                <Input 
                                    placeholder="Contoh: Rapat Komite" 
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                />
                            </div>

                            <Button 
                                className="w-full mt-4" 
                                size="lg"
                                onClick={() => handleSubmit("guest")}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                Simpan Data Tamu
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

        </div>
    );
}

