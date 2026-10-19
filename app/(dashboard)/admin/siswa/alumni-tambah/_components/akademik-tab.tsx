"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UseFormRegister, UseFormWatch, UseFormSetValue, FieldErrors } from "react-hook-form";

interface AlumniAkademikTabProps {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  errors: FieldErrors<any>;
  entryType: "tk" | "mutasi";
  setEntryType: (type: "tk" | "mutasi") => void;
  studentStatus: string;
}

export function AlumniAkademikTab({
  register,
  watch,
  setValue,
  errors,
  entryType,
  setEntryType,
  studentStatus,
}: AlumniAkademikTabProps) {
  return (
    <>
            <Card className="border-slate-200 dark:border-zinc-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Langkah 2: Riwayat Akademik & Status Siswa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status & General Academic */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="status">Status Buku Induk *</Label>
                    <Select value={watch("status")} onValueChange={(val) => setValue("status", val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="graduated">Lulus / Alumni</SelectItem>
                        <SelectItem value="transferred">Pindahan (Keluar)</SelectItem>
                        <SelectItem value="dropped">Keluar / DO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="enrolledYear">Tahun Masuk *</Label>
                    <Input id="enrolledYear" {...register("enrolledYear")} placeholder="Contoh: 2020" />
                  </div>
                  <div>
                    <Label htmlFor="finalClass">Kelas Saat Ini / Terakhir *</Label>
                    <Input id="finalClass" {...register("finalClass")} placeholder="Contoh: 6A" />
                  </div>
                </div>

                {/* Index Buku Induk Fisik */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                  <div>
                    <Label htmlFor="bukuFisikNo">Buku Induk Fisik No.</Label>
                    <Input id="bukuFisikNo" {...register("bukuFisikNo")} placeholder="mis. VI (jilid buku fisik)" />
                  </div>
                  <div>
                    <Label htmlFor="registerNo">Nomor Urut Register</Label>
                    <Input id="registerNo" type="number" {...register("registerNo")} placeholder="mis. 1421" min={0} />
                  </div>
                </div>

                {/* Asal Masuk */}
                <div className="space-y-4 border-t pt-4">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Metode Masuk / Penerimaan</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input type="radio" checked={entryType === "tk"} onChange={() => setEntryType("tk")} className="h-4 w-4 text-primary" />
                        Siswa Baru Kelas I (TK / Rumah Tangga)
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input type="radio" checked={entryType === "mutasi"} onChange={() => setEntryType("mutasi")} className="h-4 w-4 text-primary" />
                        Pindahan (Mutasi Masuk)
                      </label>
                    </div>
                  </div>

                  {entryType === "tk" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                      <div>
                        <Label htmlFor="previousSchool">TK Asal / Sumber</Label>
                        <Input id="previousSchool" {...register("previousSchool")} placeholder="Nama TK asal" />
                      </div>
                      <div>
                        <Label htmlFor="previousSchoolAddress">Alamat TK asal</Label>
                        <Input id="previousSchoolAddress" {...register("previousSchoolAddress")} placeholder="Alamat asal TK" />
                      </div>
                      <div>
                        <Label htmlFor="previousSchoolCertNo">No. Surat Keterangan / STTB TK</Label>
                        <Input id="previousSchoolCertNo" {...register("previousSchoolCertNo")} placeholder="Nomor STTB TK" />
                      </div>
                      <div>
                        <Label htmlFor="previousSchoolCertDate">Tanggal STTB TK</Label>
                        <DateInput id="previousSchoolCertDate" type="date" {...register("previousSchoolCertDate")} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in duration-200">
                      <div className="md:col-span-2">
                        <Label htmlFor="mutasiMasukAsalSekolah">Nama Sekolah Asal</Label>
                        <Input id="mutasiMasukAsalSekolah" {...register("mutasiMasukAsalSekolah")} placeholder="Sekolah asal mutasi" />
                      </div>
                      <div>
                        <Label htmlFor="mutasiMasukDariKelas">Dari Kelas</Label>
                        <Input id="mutasiMasukDariKelas" {...register("mutasiMasukDariKelas")} placeholder="Kelas asal" />
                      </div>
                      <div>
                        <Label htmlFor="mutasiMasukDiKelas">Diterima di Kelas</Label>
                        <Input id="mutasiMasukDiKelas" {...register("mutasiMasukDiKelas")} placeholder="Kelas saat diterima" />
                      </div>
                      <div className="md:col-span-4">
                        <Label htmlFor="mutasiMasukDiterimaTanggal">Diterima Tanggal</Label>
                        <DateInput id="mutasiMasukDiterimaTanggal" type="date" {...register("mutasiMasukDiterimaTanggal")} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Keluar Details based on Status */}
                {studentStatus === "graduated" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4 animate-in slide-in-from-top-2 duration-300">
                    <div>
                      <Label htmlFor="graduationYear">Tahun Lulus *</Label>
                      <Input id="graduationYear" {...register("graduationYear")} placeholder="Contoh: 2026" />
                      {errors.graduationYear?.message && <p className="text-sm text-red-500 mt-1">{String(errors.graduationYear.message)}</p>}
                    </div>
                    <div>
                      <Label htmlFor="graduationDate">Tanggal Kelulusan</Label>
                      <DateInput id="graduationDate" type="date" {...register("graduationDate")} />
                    </div>
                    <div>
                      <Label htmlFor="nextSchool">Melanjutkan Ke Sekolah (SMP/MTs)</Label>
                      <Input id="nextSchool" {...register("nextSchool")} placeholder="Contoh: SMPN 1 Indramayu" />
                    </div>
                  </div>
                )}

                {studentStatus === "transferred" && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t pt-4 animate-in slide-in-from-top-2 duration-300">
                    <div>
                      <Label htmlFor="mutationOutClass">Dari Kelas</Label>
                      <Input id="mutationOutClass" {...register("mutationOutClass")} placeholder="Kelas terakhir" />
                    </div>
                    <div>
                      <Label htmlFor="mutationOutToSchool">Ke Sekolah Tujuan</Label>
                      <Input id="mutationOutToSchool" {...register("mutationOutToSchool")} placeholder="Sekolah baru" />
                    </div>
                    <div>
                      <Label htmlFor="mutationOutToClass">Ke Kelas</Label>
                      <Input id="mutationOutToClass" {...register("mutationOutToClass")} placeholder="Kelas baru" />
                    </div>
                    <div>
                      <Label htmlFor="mutationOutDate">Tanggal Pindah</Label>
                      <DateInput id="mutationOutDate" type="date" {...register("mutationOutDate")} />
                    </div>
                  </div>
                )}

                {studentStatus === "dropped" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4 animate-in slide-in-from-top-2 duration-300">
                    <div>
                      <Label htmlFor="droppedOutDate">Tanggal Keluar</Label>
                      <DateInput id="droppedOutDate" type="date" {...register("droppedOutDate")} />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="droppedOutReason">Alasan Keluar / Putus Sekolah</Label>
                      <Input id="droppedOutReason" {...register("droppedOutReason")} placeholder="Sebutkan alasannya secara lengkap" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
    </>
  );
}
