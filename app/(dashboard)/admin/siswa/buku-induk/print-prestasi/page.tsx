"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { goGet } from "@/lib/api-client";

export default function PrestasiPrintPage() {
    const searchParams = useSearchParams();
    const studentId = searchParams.get('id');
    const [student, setStudent] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!studentId) return;
        const fetchData = async () => {
            try {
                const data = await goGet(`/api/master/students/${studentId}`);
                setStudent(data);
                setTimeout(() => window.print(), 1000);
            } catch (error) {
                console.error("Gagal mengambil data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [studentId]);

    if (loading) return <div className="p-8 text-center font-sans">Memuat dokumen cetak...</div>;
    if (!student) return <div className="p-8 text-center font-sans">Data tidak ditemukan.</div>;

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

    const classes = ["I", "II", "III", "IV", "V", "VI"];

    return (
        <div className="print-container-landscape">
            <div className="text-sm font-semibold mb-2">C.2. PRESTASI BELAJAR</div>
            <div className="text-sm font-semibold mb-2">NAMA SISWA: {student.fullName} (NIS/NISN: {student.nis || "-"}/{student.nisn || "-"})</div>
            
            <table className="prestasi-table w-full border-collapse border border-black text-center text-xs">
                <thead>
                    <tr>
                        <th className="border border-black p-1 align-middle whitespace-nowrap" rowSpan={3}>TAHUN PELAJARAN</th>
                        {classes.map((c, i) => (
                            <th key={`tahun-${i}`} className="border border-black p-1" colSpan={4}>......... / .........</th>
                        ))}
                    </tr>
                    <tr>
                        <th className="border border-black p-1" rowSpan={2}>MATA PELAJARAN</th>
                        {classes.map((c, i) => (
                            <th key={`kelas-${i}`} className="border border-black p-1" colSpan={4}>KELAS ............</th>
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
                                <div className="flex w-full divide-x divide-black text-[10px]">
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
                            <td className="border border-black p-1 text-left px-2 uppercase text-[10px] whitespace-nowrap">{sub}</td>
                            <td className="border border-black p-1"></td>
                            
                            {/* Empty cells for 6 classes x 4 columns = 24 cols */}
                            {classes.map((c, i) => (
                                <td key={`cell-${i}`} className="border border-black p-0" colSpan={4}>
                                    <div className="flex w-full h-full divide-x divide-black min-h-[20px]">
                                        <div className="w-1/4"></div>
                                        <div className="w-1/4"></div>
                                        <div className="w-1/4"></div>
                                        <div className="w-1/4"></div>
                                    </div>
                                </td>
                            ))}
                        </tr>
                    ))}
                    
                    {/* Totals */}
                    <tr>
                        <td className="border border-black p-1 text-left px-2 uppercase text-[10px]">JUMLAH NILAI</td>
                        <td className="border border-black p-1"></td>
                        {classes.map((c, i) => (
                            <td key={`jml-${i}`} className="border border-black p-0" colSpan={4}>
                                <div className="flex w-full h-full divide-x divide-black min-h-[20px]">
                                    <div className="w-1/4"></div>
                                    <div className="w-1/4"></div>
                                    <div className="w-1/4"></div>
                                    <div className="w-1/4"></div>
                                </div>
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td className="border border-black p-1 text-left px-2 uppercase text-[10px]">NILAI RATA-RATA</td>
                        <td className="border border-black p-1"></td>
                        {classes.map((c, i) => (
                            <td key={`rata-${i}`} className="border border-black p-0" colSpan={4}>
                                <div className="flex w-full h-full divide-x divide-black min-h-[20px]">
                                    <div className="w-1/4"></div>
                                    <div className="w-1/4"></div>
                                    <div className="w-1/4"></div>
                                    <div className="w-1/4"></div>
                                </div>
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td className="border border-black p-1 text-left px-2 uppercase text-[10px]">PERINGKAT KELAS</td>
                        <td className="border border-black p-1"></td>
                        {classes.map((c, i) => (
                            <td key={`rank-${i}`} className="border border-black p-0" colSpan={4}>
                                <div className="flex w-full h-full divide-x divide-black min-h-[20px]">
                                    <div className="w-1/4"></div>
                                    <div className="w-1/4"></div>
                                    <div className="w-1/4"></div>
                                    <div className="w-1/4"></div>
                                </div>
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td className="border border-black p-1 text-left px-2 uppercase text-[10px]" colSpan={2}>NAIK/TIDAK NAIK TINGKAT</td>
                        {classes.map((c, i) => (
                            <td key={`naik-${i}`} className="border border-black p-1 text-[9px] whitespace-nowrap" colSpan={4}>
                                NAIK/TIDAK NAIK KE<br/>
                                KELAS ..............
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
            
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
                
                body {
                    background-color: white;
                }
                
                .print-container-landscape {
                    font-family: 'Times New Roman', Times, serif, sans-serif;
                    color: black;
                    padding: 1cm;
                    width: 100%;
                }
                
                @page {
                    size: A4 landscape;
                    margin: 1cm;
                }
                
                @media print {
                    .print-container-landscape {
                        padding: 0;
                    }
                }
            `}</style>
        </div>
    );
}
