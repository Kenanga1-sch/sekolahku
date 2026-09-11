import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SPMB 2026/2027 — Pendaftaran Siswa Baru",
  description:
    "Pendaftaran siswa baru (SPMB) jalur domisili UPTD SDN 1 Kenanga Sungai Penuh. Alur pendaftaran online, syarat dokumen, lacak status, dan verifikasi berkas — semuanya daring.",
  alternates: { canonical: "/spmb" },
  openGraph: {
    title: "SPMB 2026/2027 — Pendaftaran Siswa Baru",
    description:
      "Daftar siswa baru SDN 1 Kenanga Sungai Penuh secara online: alur, syarat dokumen, lacak status pendaftaran, dan verifikasi berkas.",
    url: "/spmb",
  },
};

export default function SPMBLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
