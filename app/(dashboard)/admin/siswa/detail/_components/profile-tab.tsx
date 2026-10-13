"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ProfileTabProps {
    student: any;
    meta: any;
}

export function ProfileTab({ student, meta }: ProfileTabProps) {
    return (
      <>
        {/* 1. DATA PRIBADI */}
        <Card>
            <CardHeader>
                <CardTitle>Data Pribadi</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                        <Label className="text-muted-foreground text-xs">Nama Lengkap</Label>
                        <div className="font-semibold text-sm mt-1">{student.fullName || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Jenis Kelamin</Label>
                        <div className="font-semibold text-sm mt-1">{student.gender === "L" ? "Laki-laki" : student.gender === "P" ? "Perempuan" : "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">NISN</Label>
                        <div className="font-semibold text-sm mt-1">{student.nisn || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">NIS (Lokal)</Label>
                        <div className="font-semibold text-sm mt-1">{student.nis || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">NIK</Label>
                        <div className="font-semibold text-sm mt-1">{student.nik || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Tempat, Tanggal Lahir</Label>
                        <div className="font-semibold text-sm mt-1">
                            {student.birthPlace || "-"}, {student.birthDate || "-"}
                        </div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Agama</Label>
                        <div className="font-semibold text-sm mt-1">{student.religion || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Nomor KIP</Label>
                        <div className="font-semibold text-sm mt-1">{student.kip || "-"}</div>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* 2. ALAMAT & KONTAK */}
        <Card>
            <CardHeader>
                <CardTitle>Alamat & Kontak</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="col-span-2">
                        <Label className="text-muted-foreground text-xs">Alamat Jalan</Label>
                        <div className="font-semibold text-sm mt-1">{student.address || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">RT / RW</Label>
                        <div className="font-semibold text-sm mt-1">
                            {(meta.rt !== undefined && meta.rt !== null && String(meta.rt).trim() !== "") ? `RT ${meta.rt}` : "-"} / {(meta.rw !== undefined && meta.rw !== null && String(meta.rw).trim() !== "") ? `RW ${meta.rw}` : "-"}
                        </div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Nama Dusun</Label>
                        <div className="font-semibold text-sm mt-1">{meta.dusun || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Kelurahan / Desa</Label>
                        <div className="font-semibold text-sm mt-1">{meta.kelurahan || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Kode Pos</Label>
                        <div className="font-semibold text-sm mt-1">{meta.kodePos || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Jenis Tinggal</Label>
                        <div className="font-semibold text-sm mt-1">{meta.jenisTinggal || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Alat Transportasi</Label>
                        <div className="font-semibold text-sm mt-1">{meta.alatTransportasi || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">No. Telepon Seluler (HP)</Label>
                        <div className="font-semibold text-sm mt-1">{student.parentPhone || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">No. Telepon Rumah</Label>
                        <div className="font-semibold text-sm mt-1">{meta.teleponRumah || "-"}</div>
                    </div>
                    <div className="col-span-2">
                        <Label className="text-muted-foreground text-xs">Email</Label>
                        <div className="font-semibold text-sm mt-1">{meta.email || "-"}</div>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* 3. DATA ORANG TUA / WALI */}
        <Card>
            <CardHeader>
                <CardTitle>Data Orang Tua & Wali</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Section Ayah */}
                <div className="border-b pb-6">
                    <h4 className="font-bold text-sm mb-4 text-primary">Detail Ayah Kandung</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        <div>
                            <Label className="text-muted-foreground text-xs">Nama Ayah</Label>
                            <div className="font-semibold text-sm mt-1">{student.fatherName || "-"}</div>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">NIK Ayah</Label>
                            <div className="font-semibold text-sm mt-1">{meta.fatherNik || "-"}</div>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Tahun Lahir Ayah</Label>
                            <div className="font-semibold text-sm mt-1">{meta.fatherBirthYear || "-"}</div>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Pendidikan Ayah</Label>
                            <div className="font-semibold text-sm mt-1">{meta.fatherEducation || "-"}</div>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Pekerjaan Ayah</Label>
                            <div className="font-semibold text-sm mt-1">{meta.fatherJob || "-"}</div>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Penghasilan Ayah</Label>
                            <div className="font-semibold text-sm mt-1">{meta.fatherIncome || "-"}</div>
                        </div>
                    </div>
                </div>

                {/* Section Ibu */}
                <div className="border-b pb-6">
                    <h4 className="font-bold text-sm mb-4 text-primary">Detail Ibu Kandung</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        <div>
                            <Label className="text-muted-foreground text-xs">Nama Ibu</Label>
                            <div className="font-semibold text-sm mt-1">{student.motherName || "-"}</div>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">NIK Ibu</Label>
                            <div className="font-semibold text-sm mt-1">{meta.motherNik || "-"}</div>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Tahun Lahir Ibu</Label>
                            <div className="font-semibold text-sm mt-1">{meta.motherBirthYear || "-"}</div>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Pendidikan Ibu</Label>
                            <div className="font-semibold text-sm mt-1">{meta.motherEducation || "-"}</div>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Pekerjaan Ibu</Label>
                            <div className="font-semibold text-sm mt-1">{meta.motherJob || "-"}</div>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Penghasilan Ibu</Label>
                            <div className="font-semibold text-sm mt-1">{meta.motherIncome || "-"}</div>
                        </div>
                    </div>
                </div>

                {/* Section Wali (Hanya Tampil Jika Ada) */}
                {student.guardianName && (
                    <div>
                        <h4 className="font-bold text-sm mb-4 text-primary">Detail Wali</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            <div>
                                <Label className="text-muted-foreground text-xs">Nama Wali</Label>
                                <div className="font-semibold text-sm mt-1">{student.guardianName || "-"}</div>
                            </div>
                            <div>
                                <Label className="text-muted-foreground text-xs">NIK Wali</Label>
                                <div className="font-semibold text-sm mt-1">{meta.guardianNik || "-"}</div>
                            </div>
                            <div>
                                <Label className="text-muted-foreground text-xs">Tahun Lahir Wali</Label>
                                <div className="font-semibold text-sm mt-1">{meta.guardianBirthYear || "-"}</div>
                            </div>
                            <div>
                                <Label className="text-muted-foreground text-xs">Pendidikan Wali</Label>
                                <div className="font-semibold text-sm mt-1">{meta.guardianEducation || "-"}</div>
                            </div>
                            <div>
                                <Label className="text-muted-foreground text-xs">Pekerjaan Wali</Label>
                                <div className="font-semibold text-sm mt-1">{meta.guardianJob || "-"}</div>
                            </div>
                            <div>
                                <Label className="text-muted-foreground text-xs">Penghasilan Wali</Label>
                                <div className="font-semibold text-sm mt-1">{meta.guardianIncome || "-"}</div>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* 4. DATA PERIODIK & LONGITUDINAL */}
        <Card>
            <CardHeader>
                <CardTitle>Data Periodik & Longitudinal</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                        <Label className="text-muted-foreground text-xs">Tinggi Badan</Label>
                        <div className="font-semibold text-sm mt-1">{meta.tinggiBadan ? `${meta.tinggiBadan} cm` : "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Berat Badan</Label>
                        <div className="font-semibold text-sm mt-1">{meta.beratBadan ? `${meta.beratBadan} kg` : "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Lingkar Kepala</Label>
                        <div className="font-semibold text-sm mt-1">{meta.lingkarKepala ? `${meta.lingkarKepala} cm` : "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Jarak Rumah ke Sekolah</Label>
                        <div className="font-semibold text-sm mt-1">{meta.jarakSekolah || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Waktu Tempuh</Label>
                        <div className="font-semibold text-sm mt-1">{meta.waktuTempuh || "-"}</div>
                    </div>
                    <div>
                        <Label className="text-muted-foreground text-xs">Jumlah Saudara Kandung</Label>
                        <div className="font-semibold text-sm mt-1">{(meta.jumlahSaudara !== undefined && meta.jumlahSaudara !== null) ? `${meta.jumlahSaudara} orang` : "-"}</div>
                    </div>
                </div>
            </CardContent>
        </Card>
      </>
    );
}
