"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    ArrowLeft,
    User,
    MapPin,
    Phone,
    FileText,
    Calendar,
    CheckCircle,
    XCircle,
    Clock,
    Trash2,
    Save,
    Loader2,
    Briefcase,
    GraduationCap,
    Home,
} from "lucide-react";
import { PrintRegistrationCard } from "@/components/print-registration";
import { DocumentList } from "@/components/document-viewer";
import { SPMBStatusBadge } from "@/components/spmb/status-badge";

// Full Interface matching DB Schema
interface DocumentItem {
    path: string;
    type?: string;
    originalName?: string;
}

interface RegistrantDetail {
    id: string;
    registrationNumber: string;
    // Student
    fullName: string;
    studentNik: string; // Changed from nik
    nisn?: string;
    kkNumber: string;
    birthCertificateNo?: string;
    gender: "L" | "P";
    birthPlace: string;
    birthDate: string;
    religion: string;
    specialNeeds?: string;
    livingArrangement?: string;
    transportMode?: string;
    childOrder?: number;
    hasKpsPkh?: boolean;
    hasKip?: boolean;
    previousSchool?: string;

    // Address
    addressStreet: string;
    addressRt: string;
    addressRw: string;
    addressVillage: string;
    postalCode?: string;
    address: string; // Formatting fallback

    // Location
    homeLat?: number;
    homeLng?: number;
    distanceToSchool?: number;
    isInZone?: boolean;
    
    // Parents - Father
    fatherName?: string;
    fatherNik?: string;
    fatherBirthYear?: string;
    fatherEducation?: string;
    fatherJob?: string;
    fatherIncome?: string;

    // Parents - Mother
    motherName?: string;
    motherNik?: string;
    motherBirthYear?: string;
    motherEducation?: string;
    motherJob?: string;
    motherIncome?: string;

    // Parents - Guardian
    guardianName?: string;
    guardianNik?: string;
    guardianBirthYear?: string;
    guardianEducation?: string;
    guardianJob?: string;
    guardianIncome?: string;
    
    // Contact
    parentPhone: string;
    parentEmail?: string;

    documents: string | (string | DocumentItem)[]; // Can be string (JSON) or array
    
    status: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    verifiedAt?: string;
}

function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case "accepted":
            return <CheckCircle className="h-8 w-8 text-green-600" />;
        case "rejected":
            return <XCircle className="h-8 w-8 text-red-600" />;
        case "verified":
            return <CheckCircle className="h-8 w-8 text-blue-600" />;
        default:
            return <Clock className="h-8 w-8 text-amber-600" />;
    }
}

function InfoRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-medium text-sm md:text-base whitespace-pre-wrap">{value || "-"}</p>
        </div>
    );
}

export default function RegistrantDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [registrant, setRegistrant] = useState<RegistrantDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [notes, setNotes] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("");
    const [parsedDocs, setParsedDocs] = useState<(string | DocumentItem)[]>([]);
    const [maxDistance, setMaxDistance] = useState(3);

    useEffect(() => {
        fetch("/api/school-settings")
            .then(res => res.json())
            .then(data => {
                if (data.max_distance_km) {
                    setMaxDistance(data.max_distance_km);
                }
            })
            .catch(err => console.error("Failed to fetch settings", err));
    }, []);

    const fetchRegistrant = useCallback(async () => {
        try {
            const res = await fetch(`/api/spmb/registrants/${id}`);
            const data = await res.json();
            if (data.success && data.data) {
                const regData = data.data;
                setRegistrant(regData);
                setNotes(regData.notes || "");
                setSelectedStatus(regData.status);

                // Parse documents
                try {
                    let docs: (string | DocumentItem)[] = [];
                    if (typeof regData.documents === 'string') {
                        docs = JSON.parse(regData.documents);
                    } else if (Array.isArray(regData.documents)) {
                        docs = regData.documents;
                    }
                    setParsedDocs(docs);
                } catch (e) {
                    console.error("Failed to parse docs", e);
                    setParsedDocs([]);
                }
            }
        } catch (error) {
            console.error("Failed to fetch registrant:", error);
        } finally {
            setIsLoading(false);
        }
    }, [id]);
// ...

    useEffect(() => {
        fetchRegistrant();
    }, [fetchRegistrant]);

    const handleSave = async () => {
        if (!registrant) return;
        setIsSaving(true);
        try {
            await fetch(`/api/spmb/registrants/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: selectedStatus,
                    notes: notes,
                }),
            });
            fetchRegistrant();
        } catch (error) {
            console.error("Failed to save:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            await fetch(`/api/spmb/registrants/${id}`, {
                method: "DELETE",
            });
            router.push("/spmb-admin");
        } catch (error) {
            console.error("Failed to delete:", error);
        }
    };

    // Calculate real-time zone status
    const isActuallyInZone = registrant ? (registrant.distanceToSchool || 0) <= maxDistance : false;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-8 w-48" />
                </div>
                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                         <Skeleton className="h-64 w-full" />
                         <Skeleton className="h-64 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    if (!registrant) {
        return (
            <div className="text-center py-12">
                <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold mb-2">Data Tidak Ditemukan</h2>
                <p className="text-muted-foreground mb-4">Pendaftar dengan ID tersebut tidak ditemukan.</p>
                <Link href="/spmb-admin">
                    <Button>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Kembali ke Daftar
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/spmb-admin">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold uppercase tracking-tight">{registrant.fullName}</h1>
                        <p className="text-muted-foreground font-mono flex items-center gap-2">
                             {registrant.registrationNumber}
                             <span className="inline-block w-1 h-1 rounded-full bg-gray-400" />
                             {new Date(registrant.createdAt).toLocaleDateString("id-ID", { 
                                 weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
                             })}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                     <PrintRegistrationCard registrant={registrant as any} />
                    <Button variant="destructive" onClick={() => setShowDelete(true)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Hapus
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Column: Data */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Status Overview */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-start md:items-center gap-4">
                                <StatusIcon status={registrant.status} />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Status Saat Ini</p>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <SPMBStatusBadge status={registrant.status} />
                                        {registrant.verifiedAt && (
                                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-200">
                                                Diverifikasi: {new Date(registrant.verifiedAt).toLocaleDateString("id-ID")}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Student Data */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-primary" />
                                Data Calon Siswa
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-x-4 gap-y-6">
                            <InfoRow label="Nama Lengkap" value={registrant.fullName} />
                            <InfoRow label="NIK Siswa" value={registrant.studentNik} className="font-mono" />
                            <InfoRow label="NISN" value={registrant.nisn} />
                            <InfoRow label="No. Kartu Keluarga" value={registrant.kkNumber} />
                            <InfoRow label="No. Akta Kelahiran" value={registrant.birthCertificateNo} />
                            <InfoRow label="Jenis Kelamin" value={registrant.gender === "L" ? "Laki-laki" : "Perempuan"} />
                            <InfoRow label="Tempat, Tanggal Lahir" value={`${registrant.birthPlace}, ${registrant.birthDate ? new Date(registrant.birthDate).toLocaleDateString("id-ID") : "-"}`} />
                            <InfoRow label="Agama" value={registrant.religion} />
                            <InfoRow label="Berkebutuhan Khusus" value={registrant.specialNeeds && registrant.specialNeeds !== "Tidak" ? registrant.specialNeeds : "Tidak"} />
                            <InfoRow label="Anak Ke" value={registrant.childOrder} />
                            <InfoRow label="Sekolah Asal" value={registrant.previousSchool} />
                            <InfoRow label="Moda Transportasi" value={registrant.transportMode} />
                            <InfoRow label="Jenis Tinggal" value={registrant.livingArrangement} />
                            
                            <div className="md:col-span-2 flex gap-4 mt-2">
                                {registrant.hasKip && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Penerima KIP</Badge>}
                                {registrant.hasKpsPkh && <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Penerima KPS/PKH</Badge>}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Address Data */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-primary" />
                                Alamat & Lokasi
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="grid md:grid-cols-2 gap-4">
                                <InfoRow label="Alamat / Jalan" value={registrant.addressStreet} className="md:col-span-2" />
                                <InfoRow label="RT / RW" value={`${registrant.addressRt} / ${registrant.addressRw}`} />
                                <InfoRow label="Desa / Kelurahan" value={registrant.addressVillage} />
                                <InfoRow label="Kode Pos" value={registrant.postalCode} />
                             </div>
                             
                             <Separator />
                             
                             <div className="grid md:grid-cols-2 gap-4">
                                <InfoRow label="Koordinat Rumah" value={`${registrant.homeLat?.toFixed(6) || '-'}, ${registrant.homeLng?.toFixed(6) || '-'}`} className="font-mono text-xs" />
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Jarak ke Sekolah</p>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lg">{registrant.distanceToSchool?.toFixed(2) || "0.00"} km</span>
                                        <Badge className={isActuallyInZone ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                                            {isActuallyInZone ? "Dalam Zonasi" : "Luar Zonasi"}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">(Max: {maxDistance} km)</span>
                                    </div>
                                </div>
                             </div>
                        </CardContent>
                    </Card>

                    {/* Parents Data */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Briefcase className="h-5 w-5 text-primary" />
                                Data Orang Tua / Wali
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            {/* Father */}
                            <div>
                                <h3 className="font-semibold text-lg mb-4 flex items-center text-gray-800">
                                    <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">A</span>
                                    Data Ayah
                                </h3>
                                <div className="grid md:grid-cols-2 gap-x-4 gap-y-4">
                                    <InfoRow label="Nama Ayah" value={registrant.fatherName} />
                                    <InfoRow label="NIK Ayah" value={registrant.fatherNik} />
                                    <InfoRow label="Tahun Lahir" value={registrant.fatherBirthYear} />
                                    <InfoRow label="Pendidikan" value={registrant.fatherEducation} />
                                    <InfoRow label="Pekerjaan" value={registrant.fatherJob} />
                                    <InfoRow label="Penghasilan" value={registrant.fatherIncome} />
                                </div>
                            </div>

                            <Separator />

                            {/* Mother */}
                            <div>
                                <h3 className="font-semibold text-lg mb-4 flex items-center text-gray-800">
                                    <span className="bg-pink-100 text-pink-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">I</span>
                                    Data Ibu
                                </h3>
                                <div className="grid md:grid-cols-2 gap-x-4 gap-y-4">
                                    <InfoRow label="Nama Ibu" value={registrant.motherName} />
                                    <InfoRow label="NIK Ibu" value={registrant.motherNik} />
                                    <InfoRow label="Tahun Lahir" value={registrant.motherBirthYear} />
                                    <InfoRow label="Pendidikan" value={registrant.motherEducation} />
                                    <InfoRow label="Pekerjaan" value={registrant.motherJob} />
                                    <InfoRow label="Penghasilan" value={registrant.motherIncome} />
                                </div>
                            </div>
                            
                            {/* Guardian (Optional) */}
                            {registrant.guardianName && (
                                <>
                                    <Separator />
                                    <div>
                                        <h3 className="font-semibold text-lg mb-4 flex items-center text-gray-800">
                                            <span className="bg-purple-100 text-purple-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">W</span>
                                            Data Wali
                                        </h3>
                                        <div className="grid md:grid-cols-2 gap-x-4 gap-y-4">
                                            <InfoRow label="Nama Wali" value={registrant.guardianName} />
                                            <InfoRow label="NIK Wali" value={registrant.guardianNik} />
                                            <InfoRow label="Tahun Lahir" value={registrant.guardianBirthYear} />
                                            <InfoRow label="Pendidikan" value={registrant.guardianEducation} />
                                            <InfoRow label="Pekerjaan" value={registrant.guardianJob} />
                                            <InfoRow label="Penghasilan" value={registrant.guardianIncome} />
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            <Separator />
                            
                            {/* Contact Info */}
                             <div>
                                <h3 className="font-semibold text-lg mb-4 flex items-center text-gray-800">
                                    <Phone className="w-4 h-4 mr-2" />
                                    Kontak Utama
                                </h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                     <InfoRow label="No. Telepon / WA" value={registrant.parentPhone} className="text-blue-600 font-semibold" />
                                     <InfoRow label="Email" value={registrant.parentEmail} />
                                </div>
                             </div>

                        </CardContent>
                    </Card>
                    
                    {/* Documents Viewer */}
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Berkas Dokumen
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             <DocumentList 
                                documents={parsedDocs}
                                getUrl={(doc) => doc} // Assuming doc is the full path or URL
                             />
                        </CardContent>
                    </Card>

                </div>

                {/* Right Column: Actions */}
                <div className="space-y-6">
                    <Card className="border-l-4 border-l-primary shadow-md">
                        <CardHeader>
                            <CardTitle>Aksi Admin</CardTitle>
                            <CardDescription>Verifikasi dan update status pendaftar</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Status Pendaftaran</Label>
                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">⏳ Pending (Menunggu)</SelectItem>
                                        <SelectItem value="verified">✅ Terverifikasi</SelectItem>
                                        <SelectItem value="accepted">🎉 Diterima</SelectItem>
                                        <SelectItem value="rejected">❌ Ditolak</SelectItem>
                                        <SelectItem value="withdrawn">🚫 Mengundurkan Diri</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Catatan Admin</Label>
                                <Textarea
                                    placeholder="Tambahkan catatan internal (misal: berkas kurang lengkap...)"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={5}
                                    className="resize-none"
                                />
                            </div>
                            <Button onClick={handleSave} disabled={isSaving} className="w-full">
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                Simpan Perubahan
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Meta Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 w-full text-base">
                                <Clock className="h-4 w-4" />
                                Riwayat Waktu
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-3 text-sm">
                                <div className="w-1 bg-gray-200" />
                                <div>
                                    <p className="font-medium">Mendaftar</p>
                                    <p className="text-muted-foreground">
                                        {new Date(registrant.createdAt).toLocaleString("id-ID")}
                                    </p>
                                </div>
                            </div>
                            {registrant.updatedAt && registrant.updatedAt !== registrant.createdAt && (
                                <div className="flex gap-3 text-sm">
                                    <div className="w-1 bg-blue-200" />
                                    <div>
                                        <p className="font-medium">Update Terakhir</p>
                                        <p className="text-muted-foreground">
                                            {new Date(registrant.updatedAt).toLocaleString("id-ID")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Delete Dialog */}
            <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Data Pendaftar?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Data pendaftar <strong>{registrant.fullName}</strong> beserta seluruh dokumennya akan dihapus permanen dari sistem.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                            Ya, Hapus Permanen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
