import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daftar Akun Orang Tua",
  description:
    "Buat akun orang tua untuk memantau kehadiran, tabungan, dan pengumuman anak di UPTD SDN 1 Kenanga Sindang, Indramayu.",
  alternates: { canonical: "/daftar-ortu" },
};

export default function DaftarOrtuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
