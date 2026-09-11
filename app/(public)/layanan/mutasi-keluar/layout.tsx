import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pengajuan Mutasi Keluar Siswa",
  description:
    "Ajukan permohonan mutasi keluar siswa dari UPTD SDN 1 Kenanga Sungai Penuh: isi formulir online dan lengkapi dokumen yang dibutuhkan.",
  alternates: { canonical: "/layanan/mutasi-keluar" },
  openGraph: {
    title: "Pengajuan Mutasi Keluar Siswa",
    description:
      "Formulir permohonan mutasi keluar siswa dari SDN 1 Kenanga Sungai Penuh.",
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
