import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SD Negeri 1 - Website Sekolah Terpadu",
    template: "%s | SD Negeri 1",
  },
  description:
    "Portal utama SD Negeri 1 untuk informasi sekolah, pendaftaran siswa baru (SPMB) dengan sistem zonasi, dan layanan digital terintegrasi.",
  keywords: [
    "SD Negeri 1",
    "sekolah dasar",
    "pendaftaran siswa baru",
    "SPMB",
    "zonasi",
    "pendidikan",
    "Indonesia",
  ],
  authors: [{ name: "SD Negeri 1" }],
  creator: "Website Sekolah Terpadu",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "SD Negeri 1",
    title: "SD Negeri 1 - Website Sekolah Terpadu",
    description:
      "Portal utama SD Negeri 1 untuk informasi sekolah, pendaftaran siswa baru (SPMB), dan layanan digital terintegrasi.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
