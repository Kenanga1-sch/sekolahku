import type { Metadata } from "next";
import { siteConfig, getCurrentAcademicYear } from "@/lib/config";

export const metadata: Metadata = {
  title: `SPMB ${getCurrentAcademicYear()} — Pendaftaran Siswa Baru`,
  description:
    `Pendaftaran siswa baru (SPMB) jalur domisili ${siteConfig.school.name} Sindang, Indramayu. Alur pendaftaran online, syarat dokumen, lacak status, dan verifikasi berkas — semuanya daring.`,
  alternates: { canonical: "/spmb" },
  openGraph: {
    title: `SPMB ${getCurrentAcademicYear()} — Pendaftaran Siswa Baru`,
    description:
      `Daftar siswa baru ${siteConfig.school.shortName} Sindang, Indramayu secara online: alur, syarat dokumen, lacak status pendaftaran, dan verifikasi berkas.`,
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
