"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
    Mail,
    FileText,
    Calendar,
    CheckCircle,
    XCircle,
    Clock,
    Trash2,
    Save,
    Loader2,
    Printer,
    Download,
} from "lucide-react";
import { pb } from "@/lib/pocketbase";
import { PrintRegistrationCard } from "@/components/print-registration";
import { DocumentList } from "@/components/document-viewer";
import type { SPMBRegistrant } from "@/types";

function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
        pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        verified: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    const labels: Record<string, string> = {
        pending: "Pending",
        verified: "Terverifikasi",
        accepted: "Diterima",
        rejected: "Ditolak",
    };
    return (
        <Badge className={`text-sm px-3 py-1 ${styles[status] || styles.pending}`}>
            {labels[status] || status}
        </Badge>
    );
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

export default function RegistrantDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [registrant, setRegistrant] = useState<SPMBRegistrant | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [notes, setNotes] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("");

    useEffect(() => {
        fetchRegistrant();
    }, [id]);

    const fetchRegistrant = async () => {
        try {
            const record = await pb.collection("spmb_registrants").getOne<SPMBRegistrant>(id, {
                expand: "period_id",
            });
            setRegistrant(record);
            setNotes(record.notes || "");
            setSelectedStatus(record.status);
        } catch (error) {
            console.error("Failed to fetch registrant:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!registrant) return;
        setIsSaving(true);
        try {
            await pb.collection("spmb_registrants").update(id, {
                status: selectedStatus,
                notes: notes,
                verified_at: selectedStatus === "verified" ? new Date().toISOString() : registrant.verified_at,
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
            await pb.collection("spmb_registrants").delete(id);
            router.push("/spmb-admin");
        } catch (error) {
            console.error("Failed to delete:", error);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-8 w-48" />
                </div>
                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-6 w-40" />
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="grid grid-cols-2 gap-4">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-4 w-32" />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                    <div>
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-6 w-32" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-32 w-full" />
                            </CardContent>
                        </Card>
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/spmb-admin">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">{registrant.student_name || registrant.full_name}</h1>
                        <p className="text-muted-foreground font-mono">{registrant.registration_number}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <PrintRegistrationCard registrant={registrant} />
                    <Button variant="destructive" onClick={() => setShowDelete(true)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Hapus
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Status Card */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <StatusIcon status={registrant.status} />
                                <div className="flex-1">
                                    <p className="text-sm text-muted-foreground">Status Pendaftaran</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        {getStatusBadge(registrant.status)}
                                        <span className="text-sm text-muted-foreground">
                                            Terdaftar: {new Date(registrant.created).toLocaleDateString("id-ID", {
                                                day: "numeric", month: "long", year: "numeric"
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Student Data */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Data Siswa
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Nama Lengkap</p>
                                    <p className="font-medium">{registrant.student_name || registrant.full_name}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">NIK</p>
                                    <p className="font-medium font-mono">{registrant.student_nik || registrant.nik}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Tempat Lahir</p>
                                    <p className="font-medium">{registrant.birth_place || "-"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Tanggal Lahir</p>
                                    <p className="font-medium">
                                        {registrant.birth_date ? new Date(registrant.birth_date).toLocaleDateString("id-ID") : "-"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Jenis Kelamin</p>
                                    <p className="font-medium">{registrant.gender === "L" ? "Laki-laki" : "Perempuan"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Asal Sekolah</p>
                                    <p className="font-medium">{registrant.previous_school || "-"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Parent Data */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Phone className="h-5 w-5" />
                                Data Orang Tua
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Nama Orang Tua</p>
                                    <p className="font-medium">{registrant.parent_name || "-"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">No. Telepon</p>
                                    <p className="font-medium">{registrant.parent_phone || "-"}</p>
                                </div>
                                <div className="md:col-span-2">
                                    <p className="text-sm text-muted-foreground">Email</p>
                                    <p className="font-medium">{registrant.parent_email || "-"}</p>
                                </div>
                                <div className="md:col-span-2">
                                    <p className="text-sm text-muted-foreground">Alamat</p>
                                    <p className="font-medium">{registrant.address || registrant.home_address || "-"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Location Data */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                Data Lokasi & Zonasi
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Koordinat</p>
                                    <p className="font-medium font-mono">
                                        {registrant.home_lat?.toFixed(6)}, {registrant.home_lng?.toFixed(6)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Jarak ke Sekolah</p>
                                    <p className="font-medium">{registrant.distance_to_school?.toFixed(2)} km</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Status Zonasi</p>
                                    <Badge className={(registrant.is_in_zone || registrant.is_within_zone)
                                        ? "bg-green-100 text-green-700"
                                        : "bg-gray-100 text-gray-700"
                                    }>
                                        {(registrant.is_in_zone || registrant.is_within_zone) ? "Dalam Zona" : "Luar Zona"}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar - Actions */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Update Status</CardTitle>
                            <CardDescription>Ubah status dan tambah catatan</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="verified">Terverifikasi</SelectItem>
                                        <SelectItem value="accepted">Diterima</SelectItem>
                                        <SelectItem value="rejected">Ditolak</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Catatan</Label>
                                <Textarea
                                    placeholder="Tambahkan catatan..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={4}
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

                    {/* Documents */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Dokumen
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DocumentList
                                documents={registrant.documents || []}
                                getUrl={(doc) => pb.files.getURL(registrant, doc)}
                            />
                        </CardContent>
                    </Card>

                    {/* Timeline */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Riwayat
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                                    <div>
                                        <p className="text-sm font-medium">Pendaftaran</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(registrant.created).toLocaleString("id-ID")}
                                        </p>
                                    </div>
                                </div>
                                {registrant.verified_at && (
                                    <div className="flex gap-3">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                                        <div>
                                            <p className="text-sm font-medium">Diverifikasi</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(registrant.verified_at).toLocaleString("id-ID")}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {registrant.updated && registrant.updated !== registrant.created && (
                                    <div className="flex gap-3">
                                        <div className="w-2 h-2 rounded-full bg-gray-400 mt-2" />
                                        <div>
                                            <p className="text-sm font-medium">Update Terakhir</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(registrant.updated).toLocaleString("id-ID")}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Delete Dialog */}
            <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Pendaftar?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Data pendaftar "{registrant.student_name || registrant.full_name}" akan dihapus permanen.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
