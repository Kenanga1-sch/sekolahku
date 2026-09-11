import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Layanan Mutasi Siswa — Mutasi Masuk & Keluar",
  description:
    "Layanan mutasi siswa SDN 1 Kenanga Sungai Penuh: pengajuan mutasi masuk, mutasi keluar, dan pengecekan status permohonan.",
  alternates: { canonical: "/layanan/mutasi" },
  openGraph: {
    title: "Layanan Mutasi Siswa — Mutasi Masuk & Keluar",
    description:
      "Pengajuan mutasi masuk/keluar dan cek status permohonan siswa SDN 1 Kenanga Sungai Penuh.",
    url: "/layanan/mutasi",
  },
};

export default function MutasiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
