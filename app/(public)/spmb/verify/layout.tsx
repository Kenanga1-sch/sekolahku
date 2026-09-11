import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verifikasi Berkas SPMB",
  description:
    "Verifikasi kelengkapan berkas pendaftaran siswa baru (SPMB) UPTD SDN 1 Kenanga Sindang, Indramayu.",
  alternates: { canonical: "/spmb/verify" },
  openGraph: {
    title: "Verifikasi Berkas SPMB",
    description:
      "Verifikasi kelengkapan berkas pendaftaran siswa baru SDN 1 Kenanga.",
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
