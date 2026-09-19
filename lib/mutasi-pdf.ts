/**
 * Generator PDF surat permohonan mutasi keluar.
 *
 * Dipakai di portal orang tua. Data siswa sudah diverifikasi lewat akun
 * tertaut (parent_students), jadi tidak perlu input NISN/tanggal lahir
 * seperti versi publik lama.
 */

import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export interface MutasiPDFStudent {
  fullName: string;
  nisn: string;
  className?: string;
  parentName?: string;
}

export interface MutasiPDFParams {
  student: MutasiPDFStudent;
  destinationSchool: string;
  destinationStreet?: string;
  destinationVillage?: string;
  destinationDistrict?: string;
  destinationRegency?: string;
  destinationProvince?: string;
  destinationClass?: string;
  reason: string; // "domisili" | "tugas_orangtua" | "lainnya"
  reasonDetail?: string;
  schoolName: string;
  schoolCity?: string;
}

const REASON_LABEL: Record<string, string> = {
  domisili: "Pindah Domisili",
  tugas_orangtua: "Mengikuti Tugas Orang Tua",
  lainnya: "Alasan Lainnya",
};

export async function generateMutasiKeluarPDF(p: MutasiPDFParams): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();

  const reasonText =
    p.reason === "lainnya" ? p.reasonDetail || REASON_LABEL.lainnya : REASON_LABEL[p.reason] || p.reason;

  doc.setFont("times", "normal");

  // Header (surat pribadi, tanpa kop)
  doc.setFontSize(12);
  doc.text(
    `${p.schoolCity ? p.schoolCity + ", " : ""}${format(new Date(), "d MMMM yyyy", { locale: idLocale })}`,
    140,
    20,
  );

  doc.text("Hal : Permohonan Pindah Sekolah", 20, 30);

  doc.text("Yth. Kepala Sekolah", 20, 40);
  doc.text(p.schoolName || "Sekolah", 20, 46);
  doc.text("di Tempat", 20, 52);

  // Body
  doc.text("Dengan hormat,", 20, 65);
  doc.text("Saya yang bertanda tangan di bawah ini orang tua / wali murid dari:", 20, 72);

  const startY = 82;
  doc.text(`Nama`, 30, startY);
  doc.text(`: ${p.student.fullName}`, 80, startY);

  doc.text(`NISN`, 30, startY + 8);
  doc.text(`: ${p.student.nisn}`, 80, startY + 8);

  doc.text(`Kelas`, 30, startY + 16);
  doc.text(`: ${p.student.className || "-"}`, 80, startY + 16);

  doc.text("Dengan ini mengajukan permohonan pindah sekolah ke:", 20, startY + 30);

  doc.text(`Sekolah Tujuan`, 30, startY + 40);
  doc.text(`: ${p.destinationSchool}`, 80, startY + 40);

  const alamatTujuan = [p.destinationStreet, p.destinationVillage, p.destinationDistrict, p.destinationRegency, p.destinationProvince]
    .filter((s) => s && s.trim())
    .join(", ");
  if (alamatTujuan) {
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(alamatTujuan, 110);
    lines.forEach((line: string, i: number) => {
      doc.text(i === 0 ? `: ${line}` : `  ${line}`, 80, startY + 46 + i * 5);
    });
    doc.setFontSize(12);
  }

  const alamatOffset = alamatTujuan ? 8 + (doc.splitTextToSize(alamatTujuan, 110).length - 1) * 5 : 0;

  doc.text(`Alasan Pindah`, 30, startY + 48 + alamatOffset);
  doc.text(`: ${reasonText}`, 80, startY + 48 + alamatOffset);

  doc.text(
    "Demikian surat permohonan ini saya buat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.",
    20,
    startY + 65 + alamatOffset,
    { maxWidth: 170, align: "justify" },
  );

  // Footer
  doc.text("Hormat saya,", 140, startY + 90 + alamatOffset);
  doc.text("Orang Tua / Wali Murid", 140, startY + 96 + alamatOffset);

  // Meterai box
  doc.setLineWidth(0.1);
  doc.rect(142, startY + 105 + alamatOffset, 25, 25);
  doc.setFontSize(8);
  doc.text("Meterai", 145, startY + 115 + alamatOffset);
  doc.text("10.000", 145, startY + 120 + alamatOffset);

  doc.setFontSize(12);
  doc.text(`( ${p.student.parentName || "......................"} )`, 140, startY + 145 + alamatOffset);

  doc.save(`Permohonan_Mutasi_${p.student.fullName}.pdf`);
}
