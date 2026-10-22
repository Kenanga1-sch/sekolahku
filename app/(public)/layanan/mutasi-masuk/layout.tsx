import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Pengajuan Mutasi Masuk Siswa",
  description:
    `Ajukan permohonan mutasi masuk siswa ke ${siteConfig.school.name} ${siteConfig.school.region}: isi formulir online, lengkapi dokumen, dan lacak statusnya.`,
  alternates: { canonical: "/layanan/mutasi-masuk" },
  openGraph: {
    title: "Pengajuan Mutasi Masuk Siswa",
    description:
      `Formulir permohonan mutasi masuk siswa ke ${siteConfig.school.shortName} ${siteConfig.school.region}.`,
    url: "/layanan/mutasi-masuk",
  },
};

export default function MutasiMasukLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
