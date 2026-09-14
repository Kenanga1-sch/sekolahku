import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Pengajuan Mutasi Keluar Siswa",
  description:
    `Ajukan permohonan mutasi keluar siswa dari ${siteConfig.school.name} Sindang, Indramayu: isi formulir online dan lengkapi dokumen yang dibutuhkan.`,
  alternates: { canonical: "/layanan/mutasi-keluar" },
  openGraph: {
    title: "Pengajuan Mutasi Keluar Siswa",
    description:
      `Formulir permohonan mutasi keluar siswa dari ${siteConfig.school.shortName} Sindang, Indramayu.`,
    url: "/layanan/mutasi-keluar",
  },
};

export default function MutasiKeluarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
