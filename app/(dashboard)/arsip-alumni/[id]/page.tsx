"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Edit,
  Trash2,
  GraduationCap,
  User,
  FileText,
  History,
  Upload,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Phone,
  Mail,
  MapPin,
  School,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { DocumentUpload } from "@/components/alumni/document-upload";
import { PickupForm } from "@/components/alumni/pickup-form";
import { DocumentGallery } from "@/components/alumni/document-gallery";

interface AlumniDetail {
  id: string;
  nisn: string | null;
  nis: string | null;
  fullName: string;
  gender: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  graduationYear: string;
  graduationDate: Date | null;
  finalClass: string | null;
  photo: string | null;
  parentName: string | null;
  parentPhone: string | null;
  currentAddress: string | null;
  currentPhone: string | null;
  currentEmail: string | null;
  nextSchool: string | null;
  notes: string | null;
  documents: AlumniDocument[];
  pickups: DocumentPickup[];
}

interface AlumniDocument {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  verificationStatus: string;
  verifiedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  documentType: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface DocumentPickup {
  id: string;
  recipientName: string;
  recipientRelation: string | null;
  pickupDate: Date;
  notes: string | null;
  documentType: {
    id: string;
    name: string;
    code: string;
  } | null;
}

const statusConfig = {
  pending: { label: "Menunggu", icon: Clock, color: "text-yellow-600 bg-yellow-100" },
  verified: { label: "Terverifikasi", icon: CheckCircle, color: "text-green-600 bg-green-100" },
  rejected: { label: "Ditolak", icon: XCircle, color: "text-red-600 bg-red-100" },
};

export default function AlumniDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [alumni, setAlumni] = useState<AlumniDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlumni = async () => {
    try {
      const response = await fetch(`/api/alumni/${params.id}`);
      if (!response.ok) throw new Error("Alumni not found");
      const data = await response.json();
      setAlumni(data);
    } catch (error) {
      console.error("Error fetching alumni:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchAlumni();
    }
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus data alumni ini?")) return;

    try {
      await fetch(`/api/alumni/${params.id}`, { method: "DELETE" });
      router.push("/arsip-alumni");
    } catch (error) {
      console.error("Error deleting alumni:", error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!alumni) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <GraduationCap className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">Alumni tidak ditemukan</h2>
        <Link href="/arsip-alumni">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali ke Daftar Alumni
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
          <Link href="/arsip-alumni">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{alumni.fullName}</h1>
            <p className="text-muted-foreground">
              Alumni - Lulus {alumni.graduationYear}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/arsip-alumni/${alumni.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Hapus
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarImage src={alumni.photo || undefined} />
                  <AvatarFallback className="text-2xl">
                    {alumni.fullName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-semibold">{alumni.fullName}</h3>
                <Badge variant="secondary" className="mt-1">
                  {alumni.graduationYear}
                </Badge>

                <div className="w-full mt-6 space-y-3 text-left">
                  {alumni.nisn && (
                    <div className="flex items-center gap-3 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>NISN: {alumni.nisn}</span>
                    </div>
                  )}
                  {alumni.nis && (
                    <div className="flex items-center gap-3 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>NIS: {alumni.nis}</span>
                    </div>
                  )}
                  {alumni.finalClass && (
                    <div className="flex items-center gap-3 text-sm">
                      <School className="h-4 w-4 text-muted-foreground" />
                      <span>Kelas Akhir: {alumni.finalClass}</span>
                    </div>
                  )}
                  {alumni.nextSchool && (
                    <div className="flex items-center gap-3 text-sm">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span>{alumni.nextSchool}</span>
                    </div>
                  )}
                  {alumni.currentPhone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{alumni.currentPhone}</span>
                    </div>
                  )}
                  {alumni.currentEmail && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{alumni.currentEmail}</span>
                    </div>
                  )}
                  {alumni.currentAddress && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{alumni.currentAddress}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Tabs defaultValue="documents">
            <TabsList className="w-full">
              <TabsTrigger value="documents" className="flex-1">
                <FileText className="h-4 w-4 mr-1" />
                Dokumen ({alumni.documents.length})
              </TabsTrigger>
              <TabsTrigger value="pickups" className="flex-1">
                <History className="h-4 w-4 mr-1" />
                Riwayat Pengambilan ({alumni.pickups.length})
              </TabsTrigger>
              <TabsTrigger value="info" className="flex-1">
                <User className="h-4 w-4 mr-1" />
                Info Lengkap
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Dokumen Arsip</CardTitle>
                  <DocumentUpload alumniId={alumni.id} onUploadComplete={fetchAlumni} />
                </CardHeader>
                <CardContent>
                  <DocumentGallery documents={alumni.documents} onRefresh={fetchAlumni} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pickups" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Riwayat Pengambilan Dokumen</CardTitle>
                  <PickupForm alumniId={alumni.id} onPickupComplete={fetchAlumni} />
                </CardHeader>
                <CardContent>
                  {alumni.pickups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Belum ada riwayat pengambilan</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {alumni.pickups.map((pickup) => (
                        <div
                          key={pickup.id}
                          className="flex items-start gap-4 p-3 border rounded-lg"
                        >
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">
                              {pickup.documentType?.name || "Dokumen"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Diambil oleh: {pickup.recipientName}
                              {pickup.recipientRelation && ` (${pickup.recipientRelation})`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(pickup.pickupDate), "dd MMMM yyyy", {
                                locale: localeId,
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="info" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informasi Lengkap</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Tempat, Tanggal Lahir</p>
                      <p className="font-medium">
                        {alumni.birthPlace || "-"}
                        {alumni.birthDate && `, ${alumni.birthDate}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Jenis Kelamin</p>
                      <p className="font-medium">
                        {alumni.gender === "L" ? "Laki-laki" : alumni.gender === "P" ? "Perempuan" : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nama Orang Tua</p>
                      <p className="font-medium">{alumni.parentName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Telepon Orang Tua</p>
                      <p className="font-medium">{alumni.parentPhone || "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground">Catatan</p>
                      <p className="font-medium">{alumni.notes || "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
