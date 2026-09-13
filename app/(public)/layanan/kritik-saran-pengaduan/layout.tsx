import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kritik, Saran & Pengaduan",
  description:
    "Sampaikan kritik, saran, atau pengaduan (termasuk perundungan) kepada UPTD SDN 1 Kenanga Sindang, Indramayu. Bisa anonim.",
  alternates: { canonical: "/layanan/kritik-saran-pengaduan" },
  openGraph: {
    title: "Kritik, Saran & Pengaduan",
    description:
      "Sampaikan kritik, saran, atau pengaduan kepada SDN 1 Kenanga Sindang, Indramayu. Bisa anonim.",
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
