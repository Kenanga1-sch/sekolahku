import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Daftar Akun Orang Tua",
  description:
    `Buat akun orang tua untuk memantau kehadiran, tabungan, dan pengumuman anak di ${siteConfig.school.name} ${siteConfig.school.region}.`,
  alternates: { canonical: "/daftar-ortu" },
};

export default function DaftarOrtuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
