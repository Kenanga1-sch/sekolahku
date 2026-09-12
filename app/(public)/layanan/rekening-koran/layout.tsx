import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rekening Koran Tabungan Siswa",
  description:
    "Lihat dan cetak riwayat transaksi tabungan siswa UPTD SDN 1 Kenanga Sindang, Indramayu dengan NISN dan tanggal lahir.",
  alternates: { canonical: "/layanan/rekening-koran" },
  openGraph: {
    title: "Rekening Koran Tabungan Siswa",
    description:
      "Lihat dan cetak riwayat transaksi tabungan siswa SDN 1 Kenanga Sindang, Indramayu secara online.",
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
