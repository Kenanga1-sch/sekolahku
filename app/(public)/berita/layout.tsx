import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Berita & Pengumuman Sekolah",
  description:
    "Berita, pengumuman, dan informasi terbaru dari UPTD SDN 1 Kenanga Sungai Penuh: kegiatan sekolah, agenda, hasil SPMB, dan info penting lainnya.",
  alternates: { canonical: "/berita" },
  openGraph: {
    title: "Berita & Pengumuman Sekolah",
    description:
      "Berita dan pengumuman terbaru UPTD SDN 1 Kenanga Sungai Penuh.",
    url: "/berita",
  },
};

export default function BeritaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
