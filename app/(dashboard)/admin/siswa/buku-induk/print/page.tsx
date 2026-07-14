"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { goGet } from "@/lib/api-client";

export default function BukuIndukGabunganPrintPage() {
    const searchParams = useSearchParams();
    const studentId = searchParams.get('id');
    const studentIdsParam = searchParams.get('ids');
    const typeParam = searchParams.get('type');
    
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ids = studentIdsParam ? studentIdsParam.split(',') : (studentId ? [studentId] : []);
        if (ids.length === 0) {
            setLoading(false);
            return;
        }

        const fetchAll = async () => {
            try {
                const results = await Promise.all(
                    ids.map(id => {
                        const endpoint = typeParam === 'alumni' ? `/api/alumni/${id}` : `/api/master/students/${id}`;
                        return goGet(endpoint).catch(() => null);
                    })
                );
                
                const validStudents = results.filter(s => s && s.data).map(s => {
                    const student = s.data;
                    let meta = {};
                    if (student.metaData) {
                        try { meta = JSON.parse(student.metaData); } catch(e) {}
                    }
                    return { ...student, meta };
                });
                
                setStudents(validStudents);
                
                if (validStudents.length > 0) {
                    setTimeout(() => window.print(), 1000);
                }
            } catch (error) {
                console.error("Gagal mengambil data siswa", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [studentId, studentIdsParam]);

    if (loading) return <div className="p-8 text-center font-sans">Memuat dokumen cetak...</div>;
    if (students.length === 0) return <div className="p-8 text-center font-sans">Data tidak ditemukan.</div>;

    const subjects = [
        "Pendidikan Agama Budi Pekerti",
        "Pendidikan Pancasila",
        "Matematika",
        "Bahasa Indonesia",
        "IPAS",
        "PJOK",
        "Bahasa Inggris",
        "Seni Budaya",
        "Bahasa Indramayu",
        "Budi Pekerti",
        "Tari",
        "Mangrove"
    ];

    const classes = ["I", "II", "III", "IV", "V", "VI", "VII"]; // 7 columns per reference

    return (
        <div className="print-root">
            {students.map((student, index) => {
                const meta = student.meta || {};
                
                return (
                    <div key={student.id || index} className="student-print-set">
                        {/* ================= PAGE 1 (PORTRAIT) ================= */}
                        <div className="page portrait-page">
                            <div className="text-center font-bold text-lg mb-4 underline">BUKU INDUK SISWA</div>
                            
                            <div className="text-center mb-8 font-semibold text-sm">
                                Nomor Induk : {student.nis || "-"} &nbsp;&nbsp;&nbsp;&nbsp; Tahun Masuk : {meta.tahunMasuk || "-"}
                            </div>

                            {/* A. KETERANGAN SISWA */}
                            <div className="mb-4 font-bold">A. KETERANGAN SISWA</div>
                            
                            <div className="flex relative text-[11pt] leading-relaxed">
                                <div className="flex-1 z-10 pr-[3.5cm]">
                                    <table className="layout-table w-full">
                                        <tbody>
                                            <tr>
                                                <td className="w-6 align-top">1.</td>
                                                <td className="w-48 align-top">Nama Siswa</td>
                                                <td className="w-4 align-top">:</td>
                                                <td className="w-24 align-top">a. Lengkap</td>
                                                <td className="w-4 align-top">:</td>
                                                <td className="align-top dotted-fill">{student.fullName || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td className="align-top">b. Panggilan</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.namaPanggilan || ""}</td>
                                            </tr>
                                            <tr>
                                                <td className="align-top">2.</td>
                                                <td className="align-top">Jenis Kelamin</td>
                                                <td className="align-top"></td>
                                                <td className="align-top"></td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">
                                                    {student.gender === 'L' ? <><span className="line-through">Laki-laki</span>/Perempuan*)</> : student.gender === 'P' ? <>Laki-laki/<span className="line-through">Perempuan</span>*)</> : "Laki-laki/Perempuan*)"}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="align-top">3.</td>
                                                <td className="align-top">Kelahiran</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top">a. Tanggal</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{student.birthDate || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td className="align-top">b. Tempat</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{student.birthPlace || ""}</td>
                                            </tr>
                                            <tr>
                                                <td className="align-top">4.</td>
                                                <td className="align-top">Agama</td>
                                                <td className="align-top"></td>
                                                <td className="align-top"></td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{student.religion || ""}</td>
                                            </tr>
                                            <tr>
                                                <td className="align-top">5.</td>
                                                <td className="align-top">Kewarganegaraan</td>
                                                <td className="align-top"></td>
                                                <td className="align-top"></td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.kewarganegaraan || "WNI/WNA Keturunan*)"}</td>
                                            </tr>
                                            <tr>
                                                <td className="align-top">6.</td>
                                                <td className="align-top">Jumlah Saudara</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top">a. Kandung</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.jumlahSaudaraKandung || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td className="align-top">b. Tiri</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.jumlahSaudaraTiri || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td className="align-top">c. Angkat</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.jumlahSaudaraAngkat || ""}</td>
                                            </tr>
                                            <tr>
                                                <td className="align-top">7.</td>
                                                <td className="align-top" colSpan={3}>Bahasa sehari-hari di keluarga</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.bahasaSehariHari || ""}</td>
                                            </tr>
                                            <tr>
                                                <td className="align-top">8.</td>
                                                <td className="align-top">Keadaan Jasmani</td>
                                                <td className="align-top"></td>
                                                <td className="align-top">a. Berat Badan</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{(meta.beratBadan ? meta.beratBadan + " kg" : "")}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td className="align-top">b. Tinggi Badan</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{(meta.tinggiBadan ? meta.tinggiBadan + " cm" : "")}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td className="align-top">c. Gol. Darah</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.golDarah || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td className="align-top">d. Penyakit yang<br/>pernah diderita</td>
                                                <td className="align-top"><br/>:</td>
                                                <td className="align-top dotted-fill align-bottom">{meta.penyakitPernahDiderita || ""}</td>
                                            </tr>
                                            <tr>
                                                <td className="align-top">9.</td>
                                                <td className="align-top" colSpan={3}>Alamat dan No. Telepon</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{student.address ? `${student.address} ${student.parentPhone ? 'Telp: '+student.parentPhone : ''}` : ""}</td>
                                            </tr>
                                            <tr>
                                                <td className="align-top">10.</td>
                                                <td className="align-top" colSpan={3}>Bertempat tinggal pada</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.jenisTinggal || "Orangtua/menumpang/asrama*)"}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="absolute top-[3cm] right-0 photo-box">
                                    <span className="mb-2">Pas foto (3x4)</span>
                                    <span>Kelas I</span>
                                </div>
                            </div>

                            {/* B. KETERANGAN ORANG TUA/WALI SISWA */}
                            <div className="mt-6 mb-4 font-bold">B. KETERANGAN ORANG TUA/WALI SISWA</div>
                            
                            <div className="flex relative text-[11pt] leading-relaxed">
                                <div className="flex-1 z-10 pr-[3.5cm]">
                                    <table className="layout-table w-full">
                                        <tbody>
                                            <tr>
                                                <td className="align-top" colSpan={6}>Orangtua Kandung</td>
                                            </tr>
                                            <tr>
                                                <td className="w-6 align-top">a.</td>
                                                <td className="w-32 align-top">Nama</td>
                                                <td className="w-32 align-top">a) Ayah</td>
                                                <td className="w-4 align-top">:</td>
                                                <td className="align-top dotted-fill">{student.fatherName || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td className="align-top">b) Ibu</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{student.motherName || ""}</td>
                                            </tr>
                                            <tr>
                                                <td className="align-top">b.</td>
                                                <td className="align-top">Pendidikan terakhir</td>
                                                <td className="align-top">a) Ayah</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.fatherEducation || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td className="align-top">b) Ibu</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.motherEducation || ""}</td>
                                            </tr>
                                            <tr>
                                                <td className="align-top">c.</td>
                                                <td className="align-top">Pekerjaan</td>
                                                <td className="align-top">a) Ayah</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.fatherJob || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td className="align-top">b) Ibu</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.motherJob || ""}</td>
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
                                                <td className="align-top dotted-fill">{student.guardianName || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td className="align-top" colSpan={2}>b) Hubungan keluarga</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.guardianRelation || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td className="align-top" colSpan={2}>c) Pendidikan</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.guardianEducation || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td className="align-top" colSpan={2}>d) Pekerjaan</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.guardianJob || ""}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="absolute top-[3cm] right-0 photo-box">
                                    <span className="mb-2">Pas foto (3x4)</span>
                                    <span>Kelas VI</span>
                                </div>
                            </div>

                            {/* C. PERKEMBANGAN SISWA (Start) */}
                            <div className="mt-6 mb-4 font-bold">C. PERKEMBANGAN SISWA</div>
                            
                            <div className="text-[11pt] leading-relaxed">
                                <table className="layout-table w-full">
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
                                            <td className="align-top dotted-fill">{meta.asalSiswa || "Rumah Tangga/TK*)"}</td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td></td>
                                            <td className="align-top">b) Nama TK</td>
                                            <td className="align-top">:</td>
                                            <td className="align-top dotted-fill">{meta.namaTk || ""}</td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td></td>
                                            <td className="align-top">c) Alamat</td>
                                            <td className="align-top">:</td>
                                            <td className="align-top dotted-fill">{meta.alamatTk || ""}</td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td></td>
                                            <td className="align-top">d) Tanggal dan nomor surat keterangan</td>
                                            <td className="align-top">:</td>
                                            <td className="align-top dotted-fill">{meta.skTk || ""}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* ================= PAGE 2 (PORTRAIT) ================= */}
                        <div className="page portrait-page">
                            <div className="flex relative text-[11pt] leading-relaxed pt-8">
                                <div className="flex-1 z-10 pr-[3.5cm]">
                                    <table className="layout-table w-full">
                                        <tbody>
                                            <tr>
                                                <td className="w-6"></td>
                                                <td className="w-6 align-top">b.</td>
                                                <td className="align-top" colSpan={3}>Pindahan dari sekolah lain (Mutasi)</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td className="w-48 align-top pl-4">a) Nama sekolah asal</td>
                                                <td className="w-4 align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.mutasiAsalSekolah || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td className="align-top pl-4">b) Dari kelas</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.mutasiDariKelas || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td className="align-top">c.</td>
                                                <td className="align-top">a) Diterima tanggal</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.mutasiDiterimaTanggal || ""}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td className="align-top pl-4">b) Di kelas</td>
                                                <td className="align-top">:</td>
                                                <td className="align-top dotted-fill">{meta.mutasiDiKelas || ""}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="absolute top-8 right-0 photo-box">
                                    <span className="mb-2">Pas foto (3x4)</span>
                                    <span>Mutasi</span>
                                </div>
                            </div>

                            <div className="text-[11pt] leading-relaxed mt-4">
                                <table className="layout-table w-full">
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
                            <div className="pl-6 mt-4 mb-8">
                                <table className="jasmani-table w-full text-[10pt] border-collapse text-center">
                                    <tbody>
                                        <tr>
                                            <td className="w-6 border border-black p-2">a</td>
                                            <td className="text-left border border-black p-2">Tahun</td>
                                            {[...Array(6)].map((_, i) => <td key={i} className="border border-black p-2 w-[12%]"><div className="dotted-line w-full"></div></td>)}
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-2">b</td>
                                            <td className="text-left border border-black p-2">Berat badan</td>
                                            {[...Array(6)].map((_, i) => <td key={i} className="border border-black p-2"><div className="flex items-end"><div className="dotted-line flex-1"></div><span className="ml-1">kg</span></div></td>)}
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-2">c</td>
                                            <td className="text-left border border-black p-2">Tinggi badan</td>
                                            {[...Array(6)].map((_, i) => <td key={i} className="border border-black p-2"><div className="flex items-end"><div className="dotted-line flex-1"></div><span className="ml-1">cm</span></div></td>)}
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-2">d</td>
                                            <td className="text-left border border-black p-2">Penyakit</td>
                                            {[...Array(6)].map((_, i) => <td key={i} className="border border-black p-2"><div className="dotted-line w-full"></div></td>)}
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-2">e</td>
                                            <td className="text-left border border-black p-2">Kelainan jasmani</td>
                                            {[...Array(6)].map((_, i) => <td key={i} className="border border-black p-2"><div className="dotted-line w-full"></div></td>)}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* D. BEA SISWA */}
                            <div className="mb-2 font-bold">D. BEA SISWA</div>
                            <div className="text-[11pt] leading-relaxed mb-6">
                                <table className="layout-table w-full">
                                    <tbody>
                                        <tr>
                                            <td className="w-6"></td>
                                            <td className="w-48 align-top">Jenis Bea Siswa</td>
                                            <td className="w-4 align-top">:</td>
                                            <td className="align-top dotted-fill">{meta.jenisBeasiswa || ""}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* E. MENINGGALKAN SEKOLAH */}
                            <div className="mb-2 font-bold">E. MENINGGALKAN SEKOLAH</div>
                            <div className="text-[11pt] leading-relaxed mb-6">
                                <table className="layout-table w-full">
                                    <tbody>
                                        <tr>
                                            <td className="w-6 align-top">1.</td>
                                            <td className="align-top" colSpan={3}>Tamat Belajar</td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td className="w-48 align-top pl-4">a. Tahun</td>
                                            <td className="w-4 align-top">:</td>
                                            <td className="align-top">Th. <span className="inline-block w-16 border-b border-dotted border-black text-center">{meta.tamatTahun || ""}</span> No. STTB/IJAZAH <span className="inline-block w-32 border-b border-dotted border-black text-center">{meta.tamatNoIjazah || ""}</span></td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td className="align-top pl-4">b. Melanjutkan ke sekolah</td>
                                            <td className="align-top">:</td>
                                            <td className="align-top dotted-fill">{meta.melanjutkanKe ? `${meta.melanjutkanKe} di ${meta.melanjutkanKeTempat || ""}` : ""}</td>
                                        </tr>
                                        <tr>
                                            <td className="align-top pt-2">2.</td>
                                            <td className="align-top pt-2" colSpan={3}>Pindah Sekolah</td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td className="align-top pl-4">a. Dari kelas</td>
                                            <td className="align-top">:</td>
                                            <td className="align-top dotted-fill">{meta.pindahDariKelas || ""}</td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td className="align-top pl-4">b. Ke sekolah</td>
                                            <td className="align-top">:</td>
                                            <td className="align-top dotted-fill">{meta.pindahKeSekolah || ""}</td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td className="align-top pl-4">c. Ke kelas</td>
                                            <td className="align-top">:</td>
                                            <td className="align-top dotted-fill">{meta.pindahKeKelas || ""}</td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td className="align-top pl-4">d. Tanggal</td>
                                            <td className="align-top">:</td>
                                            <td className="align-top dotted-fill">{meta.pindahTanggal || ""}</td>
                                        </tr>
                                        <tr>
                                            <td className="align-top pt-2">3.</td>
                                            <td className="align-top pt-2" colSpan={3}>Keluar Sekolah</td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td className="align-top pl-4">a. Tanggal</td>
                                            <td className="align-top">:</td>
                                            <td className="align-top dotted-fill">{meta.keluarTanggal || ""}</td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td className="align-top pl-4">b. Alasan</td>
                                            <td className="align-top">:</td>
                                            <td className="align-top dotted-fill">{meta.keluarAlasan || ""}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* F. LAIN-LAIN */}
                            <div className="mb-2 font-bold">F. LAIN-LAIN</div>
                            <div className="text-[11pt] leading-relaxed mb-6">
                                <table className="layout-table w-full">
                                    <tbody>
                                        <tr>
                                            <td className="w-6"></td>
                                            <td className="w-48 align-top">Catatan yang penting</td>
                                            <td className="w-4 align-top">:</td>
                                            <td className="align-top dotted-fill">{meta.catatanLain || ""}</td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td></td>
                                            <td></td>
                                            <td className="align-top dotted-fill pt-6"></td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td></td>
                                            <td></td>
                                            <td className="align-top dotted-fill pt-6"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* ================= PAGE 3 (LANDSCAPE) ================= */}
                        <div className="page landscape-page">
                            <div className="text-sm font-semibold mb-2">C.2. PRESTASI BELAJAR</div>
                            <div className="text-sm font-semibold mb-2 uppercase">NAMA SISWA: {student.fullName || ""} (NIS/NISN: {student.nis || "-"}/{student.nisn || "-"})</div>
                            
                            <table className="prestasi-table w-full border-collapse border border-black text-center text-[9pt]">
                                <thead>
                                    <tr>
                                        <th className="border border-black p-1 align-middle whitespace-nowrap" rowSpan={3}>TAHUN PELAJARAN</th>
                                        {classes.map((c, i) => (
                                            <th key={`tahun-${i}`} className="border border-black p-1" colSpan={4}>- / -</th>
                                        ))}
                                    </tr>
                                    <tr>
                                        <th className="border border-black p-1" rowSpan={2}>MATA PELAJARAN</th>
                                        {classes.map((c, i) => (
                                            <th key={`kelas-${i}`} className="border border-black p-1" colSpan={4}>KELAS -</th>
                                        ))}
                                    </tr>
                                    <tr>
                                        {classes.map((c, i) => (
                                            <th key={`smt-${i}`} className="border border-black p-0" colSpan={4}>
                                                <div className="border-b border-black w-full py-1">SEMESTER</div>
                                                <div className="flex w-full divide-x divide-black">
                                                    <div className="w-1/2 py-1">1</div>
                                                    <div className="w-1/2 py-1">2</div>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                    <tr>
                                        <th className="border border-black p-0" colSpan={2}></th>
                                        {classes.map((c, i) => (
                                            <th key={`nanr-${i}`} className="border border-black p-0" colSpan={4}>
                                                <div className="flex w-full divide-x divide-black text-[8pt]">
                                                    <div className="w-1/4 py-1">NA</div>
                                                    <div className="w-1/4 py-1">NR</div>
                                                    <div className="w-1/4 py-1">NA</div>
                                                    <div className="w-1/4 py-1">NR</div>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {subjects.map((sub, idx) => (
                                        <tr key={idx}>
                                            <td className="border border-black p-1 text-left px-2 uppercase text-[9pt] whitespace-nowrap">{sub}</td>
                                            <td className="border border-black p-1"></td>
                                            {classes.map((c, i) => (
                                                <td key={`cell-${i}`} className="border border-black p-0" colSpan={4}>
                                                    <div className="flex w-full h-full divide-x divide-black min-h-[18px]">
                                                        <div className="w-1/4"></div>
                                                        <div className="w-1/4"></div>
                                                        <div className="w-1/4"></div>
                                                        <div className="w-1/4"></div>
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    
                                    <tr>
                                        <td className="border border-black p-1 text-left px-2 uppercase text-[9pt]">JUMLAH NILAI</td>
                                        <td className="border border-black p-1"></td>
                                        {classes.map((c, i) => (
                                            <td key={`jml-${i}`} className="border border-black p-0" colSpan={4}>
                                                <div className="flex w-full h-full divide-x divide-black min-h-[18px]">
                                                    <div className="w-1/4"></div>
                                                    <div className="w-1/4"></div>
                                                    <div className="w-1/4"></div>
                                                    <div className="w-1/4"></div>
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 text-left px-2 uppercase text-[9pt]">NILAI RATA-RATA</td>
                                        <td className="border border-black p-1"></td>
                                        {classes.map((c, i) => (
                                            <td key={`rata-${i}`} className="border border-black p-0" colSpan={4}>
                                                <div className="flex w-full h-full divide-x divide-black min-h-[18px]">
                                                    <div className="w-1/4"></div>
                                                    <div className="w-1/4"></div>
                                                    <div className="w-1/4"></div>
                                                    <div className="w-1/4"></div>
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 text-left px-2 uppercase text-[9pt]">PERINGKAT KELAS</td>
                                        <td className="border border-black p-1"></td>
                                        {classes.map((c, i) => (
                                            <td key={`rank-${i}`} className="border border-black p-0" colSpan={4}>
                                                <div className="flex w-full h-full divide-x divide-black min-h-[18px]">
                                                    <div className="w-1/4"></div>
                                                    <div className="w-1/4"></div>
                                                    <div className="w-1/4"></div>
                                                    <div className="w-1/4"></div>
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 text-left px-2 uppercase text-[9pt]" colSpan={2}>NAIK/TIDAK NAIK TINGKAT</td>
                                        {classes.map((c, i) => (
                                            <td key={`naik-${i}`} className="border border-black p-1 text-[8pt] whitespace-nowrap" colSpan={4}>
                                                NAIK/TIDAK NAIK KE<br/>
                                                KELAS -
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
                
                body {
                    background-color: #f0f0f0; /* Default preview bg */
                }
                
                .print-root {
                    font-family: 'Times New Roman', Times, serif, sans-serif;
                    color: black;
                }

                .student-print-set {
                    display: block;
                }
                
                .page {
                    background-color: white;
                    margin: 20px auto;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    position: relative;
                }

                .portrait-page {
                    width: 21cm;
                    min-height: 29.7cm;
                    padding: 1.5cm 1.5cm 1.5cm 2.5cm; /* left margin larger */
                }

                .landscape-page {
                    width: 29.7cm;
                    min-height: 21cm;
                    padding: 1cm;
                }

                .layout-table td {
                    padding-bottom: 0.35rem;
                }

                .dotted-fill {
                    border-bottom: 1px dotted black;
                    min-width: 20px;
                }

                .dotted-line {
                    height: 1em;
                }

                .photo-box {
                    width: 3cm;
                    height: 4cm;
                    border: 1px solid black;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    font-size: 9pt;
                    background-color: white; /* Prevent dotted lines from showing through */
                    z-index: 20;
                }
                
                @page portrait-page {
                    size: A4 portrait;
                    margin: 1.5cm 1.5cm 1.5cm 2.5cm;
                }

                @page landscape-page {
                    size: A4 landscape;
                    margin: 1cm;
                }
                
                @media print {
                    /* Sembunyikan semua elemen layout (header, sidebar, nav) */
                    body * {
                        visibility: hidden;
                    }
                    .print-root, .print-root * {
                        visibility: visible;
                    }
                    .print-root {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    body {
                        background-color: white;
                    }
                    
                    .page {
                        margin: 0;
                        box-shadow: none;
                        break-after: page;
                        page-break-after: always;
                    }

                    .portrait-page {
                        page: portrait-page;
                        width: 21cm !important;
                        max-height: 29.7cm !important;
                        overflow: hidden; /* Mencegah tumpah ke halaman ke-4 */
                    }

                    .landscape-page {
                        page: landscape-page;
                        width: 29.7cm !important;
                        max-height: 21cm !important;
                        overflow: hidden;
                    }

                    table { page-break-inside: avoid; }
                }
            `}</style>
        </div>
    );
}
