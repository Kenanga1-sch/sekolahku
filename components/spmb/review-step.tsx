"use client";

// Removed Card imports
import { Button } from "@/components/ui/button";
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
    documents: any;
  };
  onEdit: (step: number) => void;
}

// ReviewSection refactored to be lighter (no Card wrapper)
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
    <div className="bg-zinc-100/50 dark:bg-zinc-800/50 rounded-2xl p-5 border border-zinc-200/50 dark:border-zinc-700/50 backdrop-blur-sm hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 transition-colors">
      <div className="flex flex-row items-center justify-between mb-4">
        <h3 className="text-base font-semibold flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </h3>
        <Button variant="ghost" size="sm" onClick={() => onEdit(step)} className="h-8 hover:bg-primary/10 hover:text-primary">
          <Edit className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Button>
      </div>
      <Separator className="bg-zinc-200 dark:bg-zinc-700 mb-4" />
      <div>{children}</div>
    </div>
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
          <div className="space-y-4">
            {/* Ayah */}
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-blue-600 dark:text-blue-400">Ayah Kandung</h4>
              <DataRow label="Nama" value={parent.father_name} />
              <DataRow label="NIK" value={parent.father_nik} />
              <DataRow label="Pekerjaan" value={parent.father_job} />
              <DataRow label="Penghasilan" value={parent.father_income} />
              <DataRow label="Pendidikan" value={parent.father_education} />
            </div>
            
            <Separator />

            {/* Ibu */}
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-pink-600 dark:text-pink-400">Ibu Kandung</h4>
              <DataRow label="Nama" value={parent.mother_name} />
              <DataRow label="NIK" value={parent.mother_nik} />
              <DataRow label="Pekerjaan" value={parent.mother_job} />
              <DataRow label="Penghasilan" value={parent.mother_income} />
              <DataRow label="Pendidikan" value={parent.mother_education} />
            </div>

            {/* Wali (Opsional) */}
            {parent.guardian_name && (
              <>
                <Separator />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm text-amber-600 dark:text-amber-400">Wali</h4>
                  <DataRow label="Nama" value={parent.guardian_name} />
                  <DataRow label="NIK" value={parent.guardian_nik || "-"} />
                  <DataRow label="Pekerjaan" value={parent.guardian_job || "-"} />
                </div>
              </>
            )}

            <Separator />

             {/* Kontak */}
            <div className="space-y-1">
               <h4 className="font-semibold text-sm">Kontak & Alamat</h4>
               <DataRow label="Nomor HP" value={parent.parent_phone} />
               <DataRow label="Email" value={parent.parent_email || "-"} />
               <DataRow 
                  label="Alamat" 
                  value={`${parent.address_street}, RT ${parent.address_rt}/RW ${parent.address_rw}, ${parent.address_village}`} 
               />
               <DataRow label="Kode Pos" value={parent.postal_code || "-"} />
            </div>
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
          {documents && Object.entries(documents as Record<string, File>).map(([key, file]) => {
            if (!file) return null;
            const labels: Record<string, string> = {
              kk: "Kartu Keluarga",
              akte: "Akta Kelahiran",
              ktp_ayah: "KTP Ayah",
              ktp_ibu: "KTP Ibu",
              pas_foto: "Pas Foto",
              ijazah: "Ijazah",
              kip: "KIP",
              kps: "KPS"
            };
            return (
              <div
                key={key}
                className="flex items-center gap-2 text-sm"
              >
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium min-w-[120px]">{labels[key] || key}:</span>
                <span>{file.name}</span>
                <span className="text-muted-foreground">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            );
          })}
          {(!documents || Object.keys(documents).length === 0) && (
            <p className="text-amber-600 text-sm">⚠️ Belum ada dokumen yang diupload</p>
          )}
        </div>
      </ReviewSection>
    </div>
  );
}
