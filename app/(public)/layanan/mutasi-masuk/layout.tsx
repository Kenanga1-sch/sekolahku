import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pengajuan Mutasi Masuk Siswa",
  description:
    "Ajukan permohonan mutasi masuk siswa ke UPTD SDN 1 Kenanga Sindang, Indramayu: isi formulir online, lengkapi dokumen, dan lacak statusnya.",
  alternates: { canonical: "/layanan/mutasi-masuk" },
  openGraph: {
    title: "Pengajuan Mutasi Masuk Siswa",
    description:
      "Formulir permohonan mutasi masuk siswa ke SDN 1 Kenanga Sindang, Indramayu.",
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
