import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Layanan Tabungan Siswa — Cek Saldo & Rekening Koran",
  description:
    "Layanan tabungan siswa SDN 1 Kenanga Sindang, Indramayu: cek saldo tabungan kelas dan cetak rekening koran siswa.",
  alternates: { canonical: "/layanan/tabungan" },
  openGraph: {
    title: "Layanan Tabungan Siswa — Cek Saldo & Rekening Koran",
    description:
      "Cek saldo tabungan kelas dan cetak rekening koran siswa SDN 1 Kenanga Sindang, Indramayu.",
    url: "/layanan/tabungan",
  },
};

export default function TabunganLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
