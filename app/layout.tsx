import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap", // Faster text rendering
  preload: true,
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
      <head>
        <meta name="theme-color" content="#3b82f6" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1e3a8a" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Sekolahku" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('SW registered: ', registration);
                    },
                    function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
