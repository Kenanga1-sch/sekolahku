import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cek Saldo Tabungan Siswa",
  description:
    "Cek saldo tabungan kelas siswa UPTD SDN 1 Kenanga Sindang, Indramayu secara online dan instan.",
  alternates: { canonical: "/layanan/cek-saldo" },
  openGraph: {
    title: "Cek Saldo Tabungan Siswa",
    description:
      "Cek saldo tabungan kelas siswa SDN 1 Kenanga Sindang, Indramayu secara online.",
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
