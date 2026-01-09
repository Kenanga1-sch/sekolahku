"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Search,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  FileSearch,
  User,
  MapPin,
  FileText,
} from "lucide-react";
import { trackingFormSchema, type TrackingFormValues } from "@/lib/validations/spmb";
import { getRegistrationByNumber } from "@/lib/pocketbase";
import { formatDate, formatDistance, getStatusLabel, getStatusColor, getGenderLabel } from "@/lib/utils";
import type { SPMBRegistrant } from "@/types";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "accepted":
      return <CheckCircle className="h-6 w-6 text-green-600" />;
    case "rejected":
      return <XCircle className="h-6 w-6 text-red-600" />;
    case "verified":
      return <CheckCircle className="h-6 w-6 text-blue-600" />;
    default:
      return <Clock className="h-6 w-6 text-amber-600" />;
  }
}

export default function TrackingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [registrant, setRegistrant] = useState<SPMBRegistrant | null>(null);
  const [notFound, setNotFound] = useState(false);

  const form = useForm<TrackingFormValues>({
    resolver: zodResolver(trackingFormSchema),
    defaultValues: {
      registration_number: "",
    },
  });

  const onSubmit = async (data: TrackingFormValues) => {
    setIsLoading(true);
    setNotFound(false);
    setRegistrant(null);

    try {
      const result = await getRegistrationByNumber(data.registration_number);
      if (result) {
        setRegistrant(result);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-8">
        <div className="container">
          <Link href="/spmb">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10 mb-4 -ml-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center">
              <FileSearch className="h-7 w-7" />
            </div>
            <div>
              <Badge className="bg-white/20 mb-1">SPMB 2024/2025</Badge>
              <h1 className="text-2xl md:text-3xl font-bold">
                Cek Status Pendaftaran
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8 max-w-2xl">
        {/* Search Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Masukkan Nomor Pendaftaran
            </CardTitle>
            <CardDescription>
              Gunakan nomor pendaftaran yang Anda terima saat mendaftar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="registration_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor Pendaftaran</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="SPMB-2024-0001"
                          className="text-lg font-mono"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Mencari...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Cari Status
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Not Found */}
        {notFound && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Nomor pendaftaran tidak ditemukan. Pastikan nomor yang Anda masukkan
              benar.
            </AlertDescription>
          </Alert>
        )}

        {/* Result */}
        {registrant && (
          <div className="space-y-4">
            {/* Status Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <StatusIcon status={registrant.status} />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Status Pendaftaran</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold">
                        {getStatusLabel(registrant.status)}
                      </p>
                      <Badge className={getStatusColor(registrant.status)}>
                        {registrant.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
                {registrant.notes && (
                  <Alert className="mt-4">
                    <AlertDescription>
                      <strong>Catatan:</strong> {registrant.notes}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detail Pendaftaran</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Registration Number */}
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Nomor Pendaftaran</p>
                  <p className="text-2xl font-mono font-bold">
                    {registrant.registration_number}
                  </p>
                </div>

                <Separator />

                {/* Student Info */}
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <User className="h-4 w-4" />
                    Data Siswa
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Nama Lengkap</p>
                      <p className="font-medium">{registrant.full_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">NIK</p>
                      <p className="font-medium">{registrant.nik}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tempat, Tanggal Lahir</p>
                      <p className="font-medium">
                        {registrant.birth_place}, {formatDate(registrant.birth_date || "")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Jenis Kelamin</p>
                      <p className="font-medium">{getGenderLabel(registrant.gender || "")}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Location Info */}
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4" />
                    Lokasi & Zonasi
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Jarak ke Sekolah</p>
                      <p className="font-medium">
                        {formatDistance(registrant.distance_to_school || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status Zonasi</p>
                      <Badge
                        variant={registrant.is_within_zone ? "default" : "secondary"}
                        className={registrant.is_within_zone ? "bg-green-600" : ""}
                      >
                        {registrant.is_within_zone ? "Dalam Zona" : "Luar Zona"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Timestamps */}
                <div className="text-sm text-muted-foreground">
                  <p>Didaftarkan: {formatDate(registrant.created)}</p>
                  {registrant.verified_at && (
                    <p>Diverifikasi: {formatDate(registrant.verified_at)}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
