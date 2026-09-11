import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Guru & Staf",
  description:
    "Daftar guru dan tenaga kependidikan (GTK) UPTD SDN 1 Kenanga Sindang, Indramayu, Jambi: kepala sekolah, guru kelas, dan staf pendukung.",
  alternates: { canonical: "/guru-staf" },
  openGraph: {
    title: "Data Guru & Staf",
    description:
      "Daftar guru dan tenaga kependidikan UPTD SDN 1 Kenanga Sindang, Indramayu, Jambi.",
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
