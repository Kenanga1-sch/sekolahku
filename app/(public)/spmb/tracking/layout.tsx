import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Lacak Status Pendaftaran Siswa — SPMB",
  description:
    `Cek status pendaftaran siswa baru (SPMB) ${siteConfig.school.shortName} ${siteConfig.school.region}: menunggu verifikasi, terverifikasi, diterima, atau ditolak.`,
  alternates: { canonical: "/spmb/tracking" },
  openGraph: {
    title: "Lacak Status Pendaftaran Siswa — SPMB",
    description:
      `Cek status pendaftaran siswa baru (SPMB) ${siteConfig.school.shortName} ${siteConfig.school.region} dengan nomor registrasi.`,
    url: "/spmb/tracking",
  },
};

export default function SPMBTrackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
