"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { User, School, GraduationCap, Users, Heart, Award } from "lucide-react";
import type { AlumniDetail } from "./types-alumni";
import { formatDateString } from "./types-alumni";

interface InfoTabProps { alumni: AlumniDetail; }

export function InfoTab({ alumni }: InfoTabProps) {
  return (
    <TabsContent value="info" className="mt-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
        <Card>
          <CardHeader><CardTitle className="text-base">Informasi Lengkap Buku Induk</CardTitle></CardHeader>
          <CardContent className="space-y-6">

            <Section icon={<User className="h-4 w-4" />} title="Identitas Diri">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <Field label="Nama Lengkap" value={alumni.fullName} />
                <Field label="Nama Panggilan" value={alumni.nickname} />
                <Field label="Jenis Kelamin" value={alumni.gender === "L" ? "Laki-laki" : alumni.gender === "P" ? "Perempuan" : "-"} />
                <Field label="NISN" value={alumni.nisn} mono /><Field label="NIS" value={alumni.nis} mono /><Field label="NIK" value={alumni.nik} mono />
                <Field label="Tempat, Tanggal Lahir" value={`${alumni.birthPlace || "-"}${alumni.birthDate ? `, ${formatDateString(alumni.birthDate)}` : ""}`} />
                <Field label="Agama" value={alumni.religion} /><Field label="Kewarganegaraan" value={alumni.citizenship || "WNI"} />
                <Field label="Bahasa Sehari-hari" value={alumni.dailyLanguage} /><Field label="Bertempat Tinggal Pada" value={alumni.livingWith} />
                <Field label="Tahun Masuk" value={alumni.enrolledYear} mono />
                <div className="md:col-span-3"><Field label="Alamat Tempat Tinggal" value={alumni.address} /></div>
              </div>
            </Section>

            <Section icon={<School className="h-4 w-4" />} title="Riwayat Asal Masuk / Penerimaan">
              {alumni.mutasiMasukAsalSekolah || alumni.mutasiMasukDariKelas ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-amber-50/30 dark:bg-amber-950/10 p-3 rounded-lg border border-amber-100/50 dark:border-amber-900/30">
                  <div className="md:col-span-2"><p className="text-xs text-muted-foreground">Metode Masuk</p><p className="font-semibold text-amber-600 dark:text-amber-400">Pindahan (Mutasi Masuk)</p></div>
                  <Field label="Asal Sekolah" value={alumni.mutasiMasukAsalSekolah} /><Field label="Dari Kelas" value={alumni.mutasiMasukDariKelas} />
                  <Field label="Diterima Tanggal" value={formatDateString(alumni.mutasiMasukDiterimaTanggal)} /><Field label="Diterima di Kelas" value={alumni.mutasiMasukDiKelas} />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50/50 dark:bg-zinc-900/30 p-3 rounded-lg border">
                  <div className="md:col-span-2"><p className="text-xs text-muted-foreground">Metode Masuk</p><p className="font-semibold text-emerald-600 dark:text-emerald-400">Siswa Baru Kelas I</p></div>
                  <Field label="TK Asal" value={alumni.previousSchool} /><Field label="Alamat TK Asal" value={alumni.previousSchoolAddress} />
                  <Field label="Nomor STTB TK" value={alumni.previousSchoolCertNo} mono /><Field label="Tanggal STTB TK" value={formatDateString(alumni.previousSchoolCertDate)} />
                </div>
              )}
            </Section>

            {alumni.status !== "active" && (
              <Section icon={<GraduationCap className="h-4 w-4" />} title="Riwayat Keluar / Meninggalkan Sekolah">
                {alumni.status === "graduated" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-blue-50/30 dark:bg-blue-950/10 p-3 rounded-lg border border-blue-100/50 dark:border-blue-900/30">
                    <Field label="Tahun Lulus" value={alumni.graduationYear} className="font-semibold text-blue-600 dark:text-blue-400" />
                    <Field label="Tanggal Kelulusan" value={formatDateString(alumni.graduationDate ? alumni.graduationDate.toString() : null)} />
                    <Field label="Melanjutkan Ke Sekolah" value={alumni.nextSchool} />
                  </div>
                )}
                {alumni.status === "transferred" && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm bg-amber-50/30 dark:bg-amber-950/10 p-3 rounded-lg border border-amber-100/50 dark:border-amber-900/30">
                    <Field label="Tanggal Pindah" value={formatDateString(alumni.mutationOutDate)} /><Field label="Dari Kelas" value={alumni.mutationOutClass} />
                    <Field label="Sekolah Tujuan" value={alumni.mutationOutToSchool} /><Field label="Ke Kelas" value={alumni.mutationOutToClass} />
                  </div>
                )}
                {alumni.status === "dropped" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-rose-50/30 dark:bg-rose-950/10 p-3 rounded-lg border border-rose-100/50 dark:border-rose-900/30">
                    <Field label="Tanggal Keluar (DO)" value={formatDateString(alumni.droppedOutDate)} className="font-semibold text-rose-600 dark:text-rose-400" />
                    <div className="md:col-span-2"><Field label="Alasan Keluar / Putus Sekolah" value={alumni.droppedOutReason} /></div>
                  </div>
                )}
              </Section>
            )}

            <Section icon={<Users className="h-4 w-4" />} title="Data Orang Tua & Wali">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <ParentCard title="Ayah Kandung" items={[["Nama Lengkap", alumni.fatherName], ["NIK", alumni.fatherNik, true], ["Pendidikan", alumni.fatherEducation], ["Pekerjaan", alumni.fatherJob]]} />
                <ParentCard title="Ibu Kandung" items={[["Nama Lengkap", alumni.motherName], ["NIK", alumni.motherNik, true], ["Pendidikan", alumni.motherEducation], ["Pekerjaan", alumni.motherJob]]} />
                {(alumni.guardianName || alumni.guardianPhone) && (
                  <div className="md:col-span-2 space-y-2 p-3 border rounded-lg bg-zinc-50/40 dark:bg-white/5">
                    <p className="font-bold text-xs text-muted-foreground uppercase border-b pb-0.5">Wali Siswa</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Nama Lengkap" value={alumni.guardianName} /><Field label="Hubungan Keluarga" value={alumni.guardianRelation} />
                      <Field label="NIK Wali" value={alumni.guardianNik} mono /><Field label="Pendidikan Wali" value={alumni.guardianEducation} />
                      <Field label="Pekerjaan Wali" value={alumni.guardianJob} /><Field label="Telepon Wali" value={alumni.guardianPhone} mono />
                    </div>
                  </div>
                )}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                  <Field label="Kontak Utama Orang Tua" value={alumni.parentName} /><Field label="Telepon Kontak Utama" value={alumni.parentPhone} mono />
                </div>
                <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t pt-4 bg-slate-50/50 dark:bg-zinc-900/30 p-3 rounded-lg border">
                  <Field label="Anak Ke" value={alumni.childOrder} /><Field label="Saudara Kandung" value={alumni.siblingKandung ?? 0} />
                  <Field label="Saudara Tiri" value={alumni.siblingTiri ?? 0} /><Field label="Saudara Angkat" value={alumni.siblingAngkat ?? 0} />
                </div>
              </div>
            </Section>

            <Section icon={<Heart className="h-4 w-4" />} title="Fisik & Kesehatan Umum">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <Field label="Tinggi Badan Masuk" value={alumni.height ? `${alumni.height} cm` : "-"} />
                <Field label="Berat Badan Masuk" value={alumni.weight ? `${alumni.weight} kg` : "-"} />
                <div><p className="text-xs text-muted-foreground">Golongan Darah</p><Badge variant="outline">{alumni.bloodType || "-"}</Badge></div>
                <div className="md:col-span-3"><Field label="Catatan Medis / Riwayat Penyakit" value={alumni.medicalNotes} bg /></div>
                <div className="md:col-span-3"><Field label="Kebutuhan Khusus" value={alumni.specialNeeds} bg /></div>
              </div>
            </Section>

            <Section icon={<Award className="h-4 w-4" />} title="Beasiswa & Riwayat Pasca Kelulusan">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="md:col-span-2"><Field label="Informasi Penerimaan Beasiswa" value={alumni.scholarshipInfo} bg /></div>
                {alumni.status === "graduated" && (<>
                  <Field label="Rata-rata Nilai Ujian Akhir" value={alumni.finalGradeAvg !== null ? alumni.finalGradeAvg.toFixed(2) : "-"} />
                  <Field label="Pendidikan Terakhir" value={alumni.lastEducationLevel} />
                  <Field label="Pekerjaan / Jabatan Saat Ini" value={alumni.currentOccupation} />
                  <Field label="Nama Institusi / Perusahaan" value={alumni.currentInstitution} />
                </>)}
              </div>
            </Section>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Catatan Tambahan Buku Induk</p>
              <div className="text-sm p-3 border bg-zinc-50/50 rounded-lg dark:bg-zinc-900/40">{alumni.notes || "Tidak ada catatan khusus."}</div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </TabsContent>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <div className="space-y-3"><h4 className="font-semibold text-sm text-primary flex items-center gap-1 border-b pb-1">{icon}{title}</h4>{children}</div>;
}

function Field({ label, value, mono, bg, className }: { label: string; value?: string | number | null; mono?: boolean; bg?: boolean; className?: string }) {
  const display = value != null ? String(value) : "-";
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className={`font-medium ${bg ? "text-xs bg-muted p-2 rounded" : ""} ${mono ? "font-mono" : ""} ${className || ""}`}>{display}</p></div>;
}

function ParentCard({ title, items }: { title: string; items: [string, string | null | undefined, boolean?][] }) {
  return (
    <div className="space-y-2 p-3 border rounded-lg bg-zinc-50/40 dark:bg-white/5">
      <p className="font-bold text-xs text-muted-foreground uppercase border-b pb-0.5">{title}</p>
      <div className="space-y-1">{items.map(([label, value, mono]) => <div key={label}><p className="text-xs text-muted-foreground mt-1">{label}</p><p className={`font-medium ${mono ? "font-mono" : ""}`}>{value || "-"}</p></div>)}</div>
    </div>
  );
}