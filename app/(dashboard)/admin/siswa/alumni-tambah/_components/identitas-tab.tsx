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
import type { AlumniFormData } from "../alumni-tambah-schema";

interface AlumniTabProps {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  errors: FieldErrors<any>;
  handleNumericInput: (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof AlumniFormData) => void;
}

export function AlumniIdentitasTab({
  register,
  watch,
  setValue,
  errors,
  handleNumericInput,
}: AlumniTabProps) {
  return (
    <>
            <Card className="border-slate-200 dark:border-zinc-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Langkah 1: Identitas Diri Siswa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="fullName">Nama Lengkap *</Label>
                    <Input
                      id="fullName"
                      {...register("fullName")}
                      placeholder="Masukkan nama lengkap sesuai akta"
                      className={errors.fullName ? "border-red-500" : ""}
                    />
                    {errors.fullName?.message && <p className="text-sm text-red-500 mt-1">{String(errors.fullName.message)}</p>}
                  </div>
                  <div>
                    <Label htmlFor="nickname">Nama Panggilan</Label>
                    <Input id="nickname" {...register("nickname")} placeholder="Panggilan akrab" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="gender">Jenis Kelamin</Label>
                    <Select value={watch("gender")} onValueChange={(value) => setValue("gender", value as "L" | "P")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenis kelamin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="nisn">NISN (10 Digit)</Label>
                    <Input
                      id="nisn"
                      value={watch("nisn") || ""}
                      onChange={(e) => handleNumericInput(e, "nisn")}
                      placeholder="0123456789"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nis">NIS (Nomor Induk)</Label>
                    <Input
                      id="nis"
                      value={watch("nis") || ""}
                      onChange={(e) => handleNumericInput(e, "nis")}
                      placeholder="12345"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nik">NIK (16 Digit)</Label>
                    <Input
                      id="nik"
                      value={watch("nik") || ""}
                      onChange={(e) => handleNumericInput(e, "nik")}
                      placeholder="3212000000000000"
                      maxLength={16}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="birthPlace">Tempat Lahir</Label>
                    <Input id="birthPlace" {...register("birthPlace")} placeholder="Contoh: Indramayu" />
                  </div>
                  <div>
                    <Label htmlFor="birthDate">Tanggal Lahir</Label>
                    <DateInput id="birthDate" type="date" {...register("birthDate")} />
                  </div>
                  <div>
                    <Label htmlFor="religion">Agama</Label>
                    <Select value={watch("religion")} onValueChange={(val) => setValue("religion", val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih agama" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Islam">Islam</SelectItem>
                        <SelectItem value="Kristen">Kristen</SelectItem>
                        <SelectItem value="Katolik">Katolik</SelectItem>
                        <SelectItem value="Hindu">Hindu</SelectItem>
                        <SelectItem value="Budha">Budha</SelectItem>
                        <SelectItem value="Khonghucu">Khonghucu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="citizenship">Kewarganegaraan</Label>
                    <Input id="citizenship" {...register("citizenship")} placeholder="Contoh: WNI" />
                  </div>
                  <div>
                    <Label htmlFor="dailyLanguage">Bahasa Sehari-hari</Label>
                    <Input id="dailyLanguage" {...register("dailyLanguage")} placeholder="Bahasa dalam keluarga" />
                  </div>
                  <div>
                    <Label htmlFor="livingWith">Bertempat Tinggal Pada</Label>
                    <Select value={watch("livingWith")} onValueChange={(val) => setValue("livingWith", val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tinggal dengan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Orangtua">Orangtua Kandung</SelectItem>
                        <SelectItem value="Menumpang">Menumpang / Saudara</SelectItem>
                        <SelectItem value="Asrama">Asrama / Pondok</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                  <div>
                    <Label htmlFor="siblingKandung">Jumlah Sdr Kandung</Label>
                    <Input id="siblingKandung" type="number" {...register("siblingKandung")} min={0} />
                  </div>
                  <div>
                    <Label htmlFor="siblingTiri">Jumlah Sdr Tiri</Label>
                    <Input id="siblingTiri" type="number" {...register("siblingTiri")} min={0} />
                  </div>
                  <div>
                    <Label htmlFor="siblingAngkat">Jumlah Sdr Angkat</Label>
                    <Input id="siblingAngkat" type="number" {...register("siblingAngkat")} min={0} />
                  </div>
                </div>
              </CardContent>
            </Card>
    </>
  );
}
