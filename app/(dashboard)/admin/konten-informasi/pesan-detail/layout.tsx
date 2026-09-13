import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Detail Pesan Masuk",
  robots: { index: false },
};

export default function PesanDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
