import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Kritik, Saran & Pengaduan",
  description:
    `Sampaikan kritik, saran, atau pengaduan (termasuk perundungan) kepada ${siteConfig.school.name} ${siteConfig.school.region}. Bisa anonim.`,
  alternates: { canonical: "/layanan/kritik-saran-pengaduan" },
  openGraph: {
    title: "Kritik, Saran & Pengaduan",
    description:
      `Sampaikan kritik, saran, atau pengaduan kepada ${siteConfig.school.shortName} ${siteConfig.school.region}. Bisa anonim.`,
    url: "/layanan/kritik-saran-pengaduan",
  },
};

export default function KritikSaranPengaduanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
