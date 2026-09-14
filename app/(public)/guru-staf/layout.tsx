import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Data Guru & Staf",
  description:
    `Daftar guru dan tenaga kependidikan (GTK) ${siteConfig.school.name} Sindang, Indramayu, Jawa Barat: kepala sekolah, guru kelas, dan staf pendukung.`,
  alternates: { canonical: "/guru-staf" },
  openGraph: {
    title: "Data Guru & Staf",
    description:
      `Daftar guru dan tenaga kependidikan ${siteConfig.school.name} Sindang, Indramayu, Jawa Barat.`,
    url: "/guru-staf",
  },
};

export default function GuruStafLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
