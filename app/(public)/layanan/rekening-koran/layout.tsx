import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Rekening Koran Tabungan Siswa",
  description:
    `Lihat dan cetak riwayat transaksi tabungan siswa ${siteConfig.school.name} Sindang, Indramayu dengan NISN dan tanggal lahir.`,
  alternates: { canonical: "/layanan/rekening-koran" },
  openGraph: {
    title: "Rekening Koran Tabungan Siswa",
    description:
      `Lihat dan cetak riwayat transaksi tabungan siswa ${siteConfig.school.shortName} Sindang, Indramayu secara online.`,
    url: "/layanan/rekening-koran",
  },
};

export default function RekeningKoranLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
