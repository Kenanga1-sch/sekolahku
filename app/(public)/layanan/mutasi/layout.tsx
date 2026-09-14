import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Layanan Mutasi Siswa — Mutasi Masuk & Keluar",
  description:
    `Layanan mutasi siswa ${siteConfig.school.shortName} Sindang, Indramayu: pengajuan mutasi masuk, mutasi keluar, dan pengecekan status permohonan.`,
  alternates: { canonical: "/layanan/mutasi" },
  openGraph: {
    title: "Layanan Mutasi Siswa — Mutasi Masuk & Keluar",
    description:
      `Pengajuan mutasi masuk/keluar dan cek status permohonan siswa ${siteConfig.school.shortName} Sindang, Indramayu.`,
    url: "/layanan/mutasi",
  },
};

export default function MutasiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
