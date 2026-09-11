import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lacak Status Pendaftaran Siswa — SPMB",
  description:
    "Cek status pendaftaran siswa baru (SPMB) SDN 1 Kenanga Sungai Penuh: menunggu verifikasi, terverifikasi, diterima, atau ditolak.",
  alternates: { canonical: "/spmb/tracking" },
  openGraph: {
    title: "Lacak Status Pendaftaran Siswa — SPMB",
    description:
      "Cek status pendaftaran siswa baru (SPMB) SDN 1 Kenanga Sungai Penuh dengan nomor registrasi.",
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
