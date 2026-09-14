import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Berita & Pengumuman Sekolah",
  description:
    `Berita, pengumuman, dan informasi terbaru dari ${siteConfig.school.name} Sindang, Indramayu: kegiatan sekolah, agenda, hasil SPMB, dan info penting lainnya.`,
  alternates: { canonical: "/berita" },
  openGraph: {
    title: "Berita & Pengumuman Sekolah",
    description:
      `Berita dan pengumuman terbaru ${siteConfig.school.name} Sindang, Indramayu.`,
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
