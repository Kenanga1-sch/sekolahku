import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Verifikasi Berkas SPMB",
  description:
    `Verifikasi kelengkapan berkas pendaftaran siswa baru (SPMB) ${siteConfig.school.name} Sindang, Indramayu.`,
  alternates: { canonical: "/spmb/verify" },
  openGraph: {
    title: "Verifikasi Berkas SPMB",
    description:
      `Verifikasi kelengkapan berkas pendaftaran siswa baru ${siteConfig.school.shortName}.`,
    url: "/spmb/verify",
  },
};

export default function SPMBVerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
