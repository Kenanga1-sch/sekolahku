import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Layanan Digital Sekolah — Tabungan & Mutasi Siswa",
  description:
    "Layanan digital UPTD SDN 1 Kenanga Sungai Penuh: cek saldo tabungan siswa, rekening koran, pengajuan mutasi masuk dan keluar, serta pengecekan status permohonan.",
  alternates: { canonical: "/layanan" },
  openGraph: {
    title: "Layanan Digital Sekolah — Tabungan & Mutasi Siswa",
    description:
      "Cek saldo tabungan siswa, rekening koran, dan pengajuan mutasi masuk/keluar — layanan digital UPTD SDN 1 Kenanga Sungai Penuh.",
    url: "/layanan",
  },
};

export default function LayananLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
