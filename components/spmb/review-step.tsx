"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Edit, User, Users, MapPin, FileText, CheckCircle } from "lucide-react";
import { formatDate, formatDistance, getGenderLabel } from "@/lib/utils";
import type { StudentFormValues, ParentFormValues, LocationFormValues } from "@/lib/validations/spmb";

interface ReviewStepProps {
  data: {
    student: StudentFormValues | null;
    parent: ParentFormValues | null;
    location: LocationFormValues | null;
    documents: File[];
  };
  onEdit: (step: number) => void;
}

function ReviewSection({
  title,
  icon: Icon,
  step,
  onEdit,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  step: number;
  onEdit: (step: number) => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => onEdit(step)}>
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

function DataRow({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export default function ReviewStep({ data, onEdit }: ReviewStepProps) {
  const { student, parent, location, documents } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg">
        <CheckCircle className="h-5 w-5 text-primary" />
        <p className="text-sm">
          <strong>Periksa kembali data Anda</strong> sebelum mengirim pendaftaran.
          Data yang sudah dikirim tidak dapat diubah.
        </p>
      </div>

      {/* Student Data */}
      {student && (
        <ReviewSection title="Data Calon Siswa" icon={User} step={1} onEdit={onEdit}>
          <div className="space-y-1">
            <DataRow label="Nama Lengkap" value={student.full_name} />
            <DataRow label="NIK" value={student.nik} />
            <DataRow
              label="Tempat, Tanggal Lahir"
              value={`${student.birth_place}, ${formatDate(student.birth_date)}`}
            />
            <DataRow label="Jenis Kelamin" value={getGenderLabel(student.gender)} />
            <DataRow label="Asal Sekolah" value={student.previous_school} />
          </div>
        </ReviewSection>
      )}

      {/* Parent Data */}
      {parent && (
        <ReviewSection title="Data Orang Tua" icon={Users} step={2} onEdit={onEdit}>
          <div className="space-y-1">
            <DataRow label="Nama Orang Tua" value={parent.parent_name} />
            <DataRow label="Nomor HP" value={parent.parent_phone} />
            <DataRow label="Email" value={parent.parent_email} />
            <DataRow label="Alamat" value={parent.home_address} />
          </div>
        </ReviewSection>
      )}

      {/* Location Data */}
      {location && (
        <ReviewSection title="Lokasi Rumah" icon={MapPin} step={3} onEdit={onEdit}>
          <div className="space-y-1">
            <DataRow
              label="Koordinat"
              value={`${location.home_lat.toFixed(6)}, ${location.home_lng.toFixed(6)}`}
            />
            <DataRow
              label="Jarak ke Sekolah"
              value={formatDistance(location.distance_to_school)}
            />
            <DataRow
              label="Status Zonasi"
              value={
                location.is_within_zone ? (
                  <Badge variant="default" className="bg-green-600">
                    Dalam Zona
                  </Badge>
                ) : (
                  <Badge variant="destructive">Luar Zona</Badge>
                )
              }
            />
          </div>
        </ReviewSection>
      )}

      {/* Documents */}
      <ReviewSection title="Dokumen" icon={FileText} step={4} onEdit={onEdit}>
        <div className="space-y-2">
          {documents.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 text-sm"
            >
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>{file.name}</span>
              <span className="text-muted-foreground">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          ))}
          {documents.length === 0 && (
            <p className="text-amber-600 text-sm">⚠️ Belum ada dokumen yang diupload</p>
          )}
        </div>
      </ReviewSection>
    </div>
  );
}
