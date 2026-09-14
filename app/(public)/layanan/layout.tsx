import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Layanan Digital Sekolah — Tabungan & Mutasi Siswa",
  description:
    `Layanan digital ${siteConfig.school.name} Sindang, Indramayu: cek saldo tabungan siswa, rekening koran, pengajuan mutasi masuk dan keluar, serta pengecekan status permohonan.`,
  alternates: { canonical: "/layanan" },
  openGraph: {
    title: "Layanan Digital Sekolah — Tabungan & Mutasi Siswa",
    description:
      `Cek saldo tabungan siswa, rekening koran, dan pengajuan mutasi masuk/keluar — layanan digital ${siteConfig.school.name} Sindang, Indramayu.`,
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
