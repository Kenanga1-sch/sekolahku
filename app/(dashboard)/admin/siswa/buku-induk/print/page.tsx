"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { goGet } from "@/lib/api-client";

export default function BukuIndukPrintPage() {
    const searchParams = useSearchParams();
    const studentId = searchParams.get('id');
    const [student, setStudent] = useState<any>(null);
    const [meta, setMeta] = useState<any>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!studentId) return;
        const fetchData = async () => {
            try {
                const data = await goGet(`/api/master/students/${studentId}`);
                setStudent(data);
                if (data.metaData) {
                    try { setMeta(JSON.parse(data.metaData)); } catch(e) {}
                }
                setTimeout(() => window.print(), 1000);
            } catch (error) {
                console.error("Gagal mengambil data siswa", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [studentId]);

    if (loading) return <div className="p-8 text-center font-sans">Memuat dokumen cetak...</div>;
    if (!student) return <div className="p-8 text-center font-sans">Data tidak ditemukan.</div>;

    return (
        <div className="print-container">
            {/* PAGE 1 */}
            <div className="page-break">
                <div className="text-center font-bold text-lg mb-4 underline">BUKU INDUK SISWA</div>
                
                <div className="text-center mb-8 font-semibold text-sm">
                    Nomor Induk : {student.nis || "......................"} Tahun Masuk : {meta.tahunMasuk || "......................"}
                </div>

                {/* A. KETERANGAN SISWA */}
                <div className="mb-6 font-semibold">A. KETERANGAN SISWA</div>
                
                <div className="flex gap-4 relative">
                    <div className="flex-1 text-sm leading-relaxed relative z-10">
                        <table className="w-full layout-table">
                            <tbody>
                                <tr>
                                    <td className="w-6 align-top">1.</td>
                                    <td className="w-40 align-top">Nama Siswa</td>
                                    <td className="w-4 align-top">:</td>
                                    <td className="w-24 align-top">a. Lengkap</td>
                                    <td className="w-4 align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{student.fullName || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top">b. Panggilan</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.namaPanggilan || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td className="align-top">2.</td>
                                    <td className="align-top">Jenis Kelamin</td>
                                    <td className="align-top"></td>
                                    <td className="align-top"></td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">
                                        {student.gender === 'L' ? <><span className="line-through">Laki-laki</span>/Perempuan*)</> : student.gender === 'P' ? <>Laki-laki/<span className="line-through">Perempuan</span>*)</> : "Laki-laki/Perempuan*)"}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="align-top">3.</td>
                                    <td className="align-top">Kelahiran</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top">a. Tanggal</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{student.birthDate || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top">b. Tempat</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{student.birthPlace || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td className="align-top">4.</td>
                                    <td className="align-top">Agama</td>
                                    <td className="align-top"></td>
                                    <td className="align-top"></td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{student.religion || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td className="align-top">5.</td>
                                    <td className="align-top">Kewarganegaraan</td>
                                    <td className="align-top"></td>
                                    <td className="align-top"></td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.kewarganegaraan || "WNI/WNA Keturunan"}</td>
                                </tr>
                                <tr>
                                    <td className="align-top">6.</td>
                                    <td className="align-top">Jumlah Saudara</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top">a. Kandung</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.jumlahSaudaraKandung || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top">b. Tiri</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.jumlahSaudaraTiri || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top">c. Angkat</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.jumlahSaudaraAngkat || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td className="align-top">7.</td>
                                    <td className="align-top" colSpan={3}>Bahasa sehari-hari di keluarga</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.bahasaSehariHari || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td className="align-top">8.</td>
                                    <td className="align-top">Keadaan Jasmani</td>
                                    <td className="align-top"></td>
                                    <td className="align-top">a. Berat Badan</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{(meta.beratBadan || "......................") + " kg"}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top">b. Tinggi Badan</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{(meta.tinggiBadan || "......................") + " cm"}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top">c. Gol. Darah</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.golDarah || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top">d. Penyakit yang<br/><span className="pl-4">pernah diderita</span></td>
                                    <td className="align-top"><br/>:</td>
                                    <td className="align-top border-b border-dotted border-black"><br/>{meta.penyakitPernahDiderita || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td className="align-top pt-2">9.</td>
                                    <td className="align-top pt-2" colSpan={3}>Alamat dan No. Telepon</td>
                                    <td className="align-top pt-2">:</td>
                                    <td className="align-top pt-2 border-b border-dotted border-black">{student.address ? `${student.address} ${student.parentPhone ? 'Telp: '+student.parentPhone : ''}` : "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td className="align-top">10.</td>
                                    <td className="align-top" colSpan={3}>Bertempat tinggal pada</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.jenisTinggal || "Orangtua/menumpang/asrama*)"}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {/* FOTO BOX KELAS I */}
                    <div className="absolute top-[8rem] right-0 w-[3cm] h-[4cm] border border-black flex flex-col items-center justify-center text-xs text-center">
                        <span className="mb-2">Pas foto (3x4)</span>
                        <span>Kelas I</span>
                    </div>
                </div>

                {/* B. KETERANGAN ORANG TUA/WALI SISWA */}
                <div className="mt-8 mb-4 font-semibold">B. KETERANGAN ORANG TUA/WALI SISWA</div>
                
                <div className="flex gap-4 relative">
                    <div className="flex-1 text-sm leading-relaxed relative z-10">
                        <table className="w-full layout-table">
                            <tbody>
                                <tr>
                                    <td className="align-top" colSpan={6}>Orangtua Kandung</td>
                                </tr>
                                <tr>
                                    <td className="w-6 align-top">a.</td>
                                    <td className="w-32 align-top">Nama</td>
                                    <td className="w-32 align-top">a) Ayah</td>
                                    <td className="w-4 align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{student.fatherName || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top">b) Ibu</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{student.motherName || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td className="align-top">b.</td>
                                    <td className="align-top">Pendidikan terakhir</td>
                                    <td className="align-top">a) Ayah</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.fatherEducation || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top">b) Ibu</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.motherEducation || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td className="align-top">c.</td>
                                    <td className="align-top">Pekerjaan</td>
                                    <td className="align-top">a) Ayah</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.fatherJob || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top">b) Ibu</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.motherJob || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td className="align-top pt-2">d.</td>
                                    <td className="align-top pt-2" colSpan={2}>Wali Siswa (jika mempunyai)</td>
                                    <td className="align-top pt-2"></td>
                                    <td className="align-top pt-2"></td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td className="align-top" colSpan={2}>a) Nama</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{student.guardianName || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td className="align-top" colSpan={2}>b) Hubungan keluarga</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.guardianRelation || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td className="align-top" colSpan={2}>c) Pendidikan</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.guardianEducation || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td className="align-top" colSpan={2}>d) Pekerjaan</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.guardianJob || "..................................................."}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {/* FOTO BOX KELAS VI */}
                    <div className="absolute top-[8rem] right-0 w-[3cm] h-[4cm] border border-black flex flex-col items-center justify-center text-xs text-center">
                        <span className="mb-2">Pas foto (3x4)</span>
                        <span>Kelas VI</span>
                    </div>
                </div>

                {/* C. PERKEMBANGAN SISWA - BAGIAN BAWAH HALAMAN 1 */}
                <div className="mt-8 mb-4 font-semibold">C. PERKEMBANGAN SISWA</div>
                
                <div className="text-sm leading-relaxed">
                    <table className="w-full layout-table">
                        <tbody>
                            <tr>
                                <td className="w-6 align-top">1.</td>
                                <td className="align-top" colSpan={3}>Pendidikan sebelumnya</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td className="w-6 align-top">a.</td>
                                <td className="align-top" colSpan={2}>Masuk menjadi siswa baru kelas I</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td></td>
                                <td className="w-64 align-top">a) Asal siswa</td>
                                <td className="w-4 align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.asalSiswa || "Rumah Tangga/TK*)"}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td></td>
                                <td className="align-top">b) Nama TK</td>
                                <td className="align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.namaTk || "..................................................."}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td></td>
                                <td className="align-top">c) Alamat</td>
                                <td className="align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.alamatTk || "..................................................."}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td></td>
                                <td className="align-top">d) Tanggal dan nomor surat keterangan</td>
                                <td className="align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.skTk || "..................................................."}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PAGE 2 */}
            <div className="page-break pt-8">
                <div className="flex gap-4 relative">
                    <div className="flex-1 text-sm leading-relaxed relative z-10">
                        <table className="w-full layout-table">
                            <tbody>
                                <tr>
                                    <td className="w-6"></td>
                                    <td className="w-6 align-top">b.</td>
                                    <td className="align-top" colSpan={3}>Pindahan dari sekolah lain (Mutasi)</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td className="w-48 align-top">a) Nama sekolah asal</td>
                                    <td className="w-4 align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.mutasiAsalSekolah || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top">b) Dari kelas</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.mutasiDariKelas || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top">c. a) Diterima tanggal</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.mutasiDiterimaTanggal || "..................................................."}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td className="align-top pl-4">b) Di kelas</td>
                                    <td className="align-top">:</td>
                                    <td className="align-top border-b border-dotted border-black">{meta.mutasiDiKelas || "..................................................."}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {/* FOTO BOX MUTASI */}
                    <div className="absolute top-0 right-0 w-[3cm] h-[4cm] border border-black flex flex-col items-center justify-center text-xs text-center">
                        <span className="mb-2">Pas foto (3x4)</span>
                        <span>Mutasi</span>
                    </div>
                </div>

                <div className="text-sm leading-relaxed mt-2">
                    <table className="w-full layout-table">
                        <tbody>
                            <tr>
                                <td className="w-6 align-top">2.</td>
                                <td className="align-top">Prestasi Belajar (di halaman berikutnya)</td>
                            </tr>
                            <tr>
                                <td className="align-top">3.</td>
                                <td className="align-top">Keadaan Jasmani</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* TABLE JASMANI */}
                <div className="pl-6 mt-2 mb-6">
                    <table className="jasmani-table w-full text-sm border-collapse text-center">
                        <tbody>
                            <tr>
                                <td className="w-6 border border-black p-2 font-medium">a</td>
                                <td className="text-left border border-black p-2">Tahun</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-2 font-medium">b</td>
                                <td className="text-left border border-black p-2">Berat badan</td>
                                <td className="border border-black p-2">.......... kg</td>
                                <td className="border border-black p-2">.......... kg</td>
                                <td className="border border-black p-2">.......... kg</td>
                                <td className="border border-black p-2">.......... kg</td>
                                <td className="border border-black p-2">.......... kg</td>
                                <td className="border border-black p-2">.......... kg</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-2 font-medium">c</td>
                                <td className="text-left border border-black p-2">Tinggi badan</td>
                                <td className="border border-black p-2">.......... cm</td>
                                <td className="border border-black p-2">.......... cm</td>
                                <td className="border border-black p-2">.......... cm</td>
                                <td className="border border-black p-2">.......... cm</td>
                                <td className="border border-black p-2">.......... cm</td>
                                <td className="border border-black p-2">.......... cm</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-2 font-medium">d</td>
                                <td className="text-left border border-black p-2">Penyakit</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-2 font-medium">e</td>
                                <td className="text-left border border-black p-2">Kelainan jasmani</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                                <td className="border border-black p-2">.....................</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* D. BEA SISWA */}
                <div className="mb-2 font-semibold">D. BEA SISWA</div>
                <div className="text-sm leading-relaxed mb-6">
                    <table className="w-full layout-table">
                        <tbody>
                            <tr>
                                <td className="w-8"></td>
                                <td className="w-48 align-top">Jenis Bea Siswa</td>
                                <td className="w-4 align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.jenisBeasiswa || "..................................................."}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* E. MENINGGALKAN SEKOLAH */}
                <div className="mb-2 font-semibold">E. MENINGGALKAN SEKOLAH</div>
                <div className="text-sm leading-relaxed mb-6">
                    <table className="w-full layout-table">
                        <tbody>
                            <tr>
                                <td className="w-6 align-top">1.</td>
                                <td className="align-top" colSpan={3}>Tamat Belajar</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td className="w-48 align-top">a. Tahun</td>
                                <td className="w-4 align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.tamatTahun ? `Th. ${meta.tamatTahun} No. STTB/IJAZAH ${meta.tamatNoIjazah || "......."}` : "Th. ........ No. STTB/IJAZAH ......."}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td className="align-top">b. Melanjutkan ke sekolah</td>
                                <td className="align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.melanjutkanKe || "..................................................."}</td>
                            </tr>
                            <tr>
                                <td className="align-top pt-2">2.</td>
                                <td className="align-top pt-2" colSpan={3}>Pindah Sekolah</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td className="align-top">a. Dari kelas</td>
                                <td className="align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.pindahDariKelas || "..................................................."}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td className="align-top">b. Ke sekolah</td>
                                <td className="align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.pindahKeSekolah || "..................................................."}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td className="align-top">c. Ke kelas</td>
                                <td className="align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.pindahKeKelas || "..................................................."}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td className="align-top">d. Tanggal</td>
                                <td className="align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.pindahTanggal || "..................................................."}</td>
                            </tr>
                            <tr>
                                <td className="align-top pt-2">3.</td>
                                <td className="align-top pt-2" colSpan={3}>Keluar Sekolah</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td className="align-top">a. Tanggal</td>
                                <td className="align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.keluarTanggal || "..................................................."}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td className="align-top">b. Alasan</td>
                                <td className="align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.keluarAlasan || "..................................................."}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* F. LAIN-LAIN */}
                <div className="mb-2 font-semibold">F. LAIN-LAIN</div>
                <div className="text-sm leading-relaxed mb-6">
                    <table className="w-full layout-table">
                        <tbody>
                            <tr>
                                <td className="w-6"></td>
                                <td className="w-48 align-top">Catatan yang penting</td>
                                <td className="w-4 align-top">:</td>
                                <td className="align-top border-b border-dotted border-black">{meta.catatanLain || "........................................................................................."}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td className="align-top border-b border-dotted border-black text-transparent select-none pt-4">.</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td className="align-top border-b border-dotted border-black text-transparent select-none pt-4">.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
                
                body {
                    background-color: white;
                }
                
                .print-container {
                    font-family: 'Times New Roman', Times, serif, sans-serif;
                    color: black;
                    padding: 1cm 2cm;
                    max-width: 21cm; /* A4 width */
                    margin: 0 auto;
                }
                
                .layout-table td {
                    padding-bottom: 0.5rem;
                }
                
                .page-break {
                    page-break-after: always;
                    min-height: 27cm; /* approx A4 content height */
                }
                
                @page {
                    size: A4 portrait;
                    margin: 1.5cm 1.5cm 1.5cm 2.5cm; /* left margin larger for binding */
                }
                
                @media print {
                    .print-container {
                        padding: 0;
                        max-width: none;
                    }
                }
            `}</style>
        </div>
    );
}
