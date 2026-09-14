import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Cek Saldo Tabungan Siswa",
  description:
    `Cek saldo tabungan kelas siswa ${siteConfig.school.name} Sindang, Indramayu secara online dan instan.`,
  alternates: { canonical: "/layanan/cek-saldo" },
  openGraph: {
    title: "Cek Saldo Tabungan Siswa",
    description:
      `Cek saldo tabungan kelas siswa ${siteConfig.school.shortName} Sindang, Indramayu secara online.`,
    url: "/layanan/cek-saldo",
  },
};

export default function CekSaldoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
