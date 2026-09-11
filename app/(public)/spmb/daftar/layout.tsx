import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Formulir Pendaftaran Online — SPMB",
  description:
    "Isi formulir pendaftaran siswa baru (SPMB) SDN 1 Kenanga Sindang, Indramayu: data calon siswa, orang tua, domisili, dan unggah dokumen. Selesai dalam 10 menit.",
  alternates: { canonical: "/spmb/daftar" },
  openGraph: {
    title: "Formulir Pendaftaran Online — SPMB",
    description:
      "Formulir pendaftaran siswa baru SDN 1 Kenanga Sindang, Indramayu: data calon siswa, orang tua, domisili, unggah dokumen.",
    url: "/spmb/daftar",
  },
};

export default function SPMBDaftarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
