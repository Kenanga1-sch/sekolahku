"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UseFormRegister, UseFormWatch } from "react-hook-form";
import type { AlumniFormData } from "../alumni-tambah-schema";

interface AlumniKeluargaTabProps {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  handleNumericInput: (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof AlumniFormData) => void;
}

export function AlumniKeluargaTab({
  register,
  watch,
  handleNumericInput,
}: AlumniKeluargaTabProps) {
  return (
    <>
            {/* Orang Tua Kandung */}
            <Card className="border-slate-200 dark:border-zinc-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Orang Tua Kandung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Ayah */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 border-l-2 border-l-primary pl-2">Data Ayah</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="fatherName">Nama Lengkap Ayah</Label>
                      <Input id="fatherName" {...register("fatherName")} placeholder="Nama Ayah" />
                    </div>
                    <div>
                      <Label htmlFor="fatherNik">NIK Ayah</Label>
                      <Input
                        id="fatherNik"
                        value={watch("fatherNik") || ""}
                        onChange={(e) => handleNumericInput(e, "fatherNik")}
                        placeholder="3212..."
                        maxLength={16}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fatherEducation">Pendidikan Terakhir</Label>
                      <Input id="fatherEducation" {...register("fatherEducation")} placeholder="Contoh: SMA / S1" />
                    </div>
                    <div className="md:col-span-4">
                      <Label htmlFor="fatherJob">Pekerjaan</Label>
                      <Input id="fatherJob" {...register("fatherJob")} placeholder="Pekerjaan Ayah" />
                    </div>
                  </div>
                </div>

                {/* Ibu */}
                <div className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 border-l-2 border-l-primary pl-2">Data Ibu</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="motherName">Nama Lengkap Ibu</Label>
                      <Input id="motherName" {...register("motherName")} placeholder="Nama Ibu" />
                    </div>
                    <div>
                      <Label htmlFor="motherNik">NIK Ibu</Label>
                      <Input
                        id="motherNik"
                        value={watch("motherNik") || ""}
                        onChange={(e) => handleNumericInput(e, "motherNik")}
                        placeholder="3212..."
                        maxLength={16}
                      />
                    </div>
                    <div>
                      <Label htmlFor="motherEducation">Pendidikan Terakhir</Label>
                      <Input id="motherEducation" {...register("motherEducation")} placeholder="Contoh: D3 / S1" />
                    </div>
                    <div className="md:col-span-4">
                      <Label htmlFor="motherJob">Pekerjaan</Label>
                      <Input id="motherJob" {...register("motherJob")} placeholder="Pekerjaan Ibu" />
                    </div>
                  </div>
                </div>

                {/* Wali */}
                <div className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 border-l-2 border-l-primary pl-2">Data Wali (Jika Ada)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="guardianName">Nama Wali</Label>
                      <Input id="guardianName" {...register("guardianName")} placeholder="Nama Wali" />
                    </div>
                    <div>
                      <Label htmlFor="guardianRelation">Hubungan Keluarga</Label>
                      <Input id="guardianRelation" {...register("guardianRelation")} placeholder="Contoh: Paman / Kakek" />
                    </div>
                    <div>
                      <Label htmlFor="guardianPhone">Telepon Wali</Label>
                      <Input id="guardianPhone" {...register("guardianPhone")} placeholder="Nomor HP Wali" />
                    </div>
                    <div>
                      <Label htmlFor="guardianNik">NIK Wali</Label>
                      <Input
                        id="guardianNik"
                        value={watch("guardianNik") || ""}
                        onChange={(e) => handleNumericInput(e, "guardianNik")}
                        placeholder="3212..."
                        maxLength={16}
                      />
                    </div>
                    <div>
                      <Label htmlFor="guardianEducation">Pendidikan Terakhir</Label>
                      <Input id="guardianEducation" {...register("guardianEducation")} placeholder="Pendidikan Wali" />
                    </div>
                    <div>
                      <Label htmlFor="guardianJob">Pekerjaan</Label>
                      <Input id="guardianJob" {...register("guardianJob")} placeholder="Pekerjaan Wali" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Kontak Utama & Telepon */}
            <Card className="border-slate-200 dark:border-zinc-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Alamat Rumah & Telepon Kontak Utama</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parentName">Nama Kontak Utama (Orang Tua / Wali) *</Label>
                  <Input id="parentName" {...register("parentName")} placeholder="Nama penanggung jawab siswa" />
                </div>
                <div>
                  <Label htmlFor="parentPhone">No Telepon Kontak Utama *</Label>
                  <Input id="parentPhone" {...register("parentPhone")} placeholder="Nomor Telepon aktif" />
                </div>
                <div>
                  <Label htmlFor="currentPhone">No Telepon Siswa (Jika Ada)</Label>
                  <Input id="currentPhone" {...register("currentPhone")} placeholder="Nomor Telepon siswa" />
                </div>
                <div>
                  <Label htmlFor="currentEmail">Email Siswa (Jika Ada)</Label>
                  <Input id="currentEmail" type="email" {...register("currentEmail")} placeholder="email@domain.com" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="currentAddress">Alamat Lengkap Rumah *</Label>
                  <Textarea id="currentAddress" {...register("currentAddress")} placeholder="Alamat lengkap (RT/RW, Desa/Kelurahan, Kecamatan, Kabupaten/Kota)" rows={2} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="notes">Catatan Penting Lain-lain</Label>
                  <Textarea id="notes" {...register("notes")} placeholder="Catatan penting sejarah siswa (beasiswa, prestasi, catatan khusus)" rows={2} />
                </div>
              </CardContent>
            </Card>
    </>
  );
}
