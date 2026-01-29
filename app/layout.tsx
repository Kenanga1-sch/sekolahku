import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SchoolSettingsProvider } from "@/lib/contexts/school-settings-context";
import { SWRProvider } from "@/components/providers/swr-provider";
import { Toaster } from "@/components/ui/toaster";
import { SkipToContent } from "@/components/accessibility";
import { ZXingConfig } from "@/components/zxing-config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap", // Faster text rendering
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "SDN 1 Kenanga",
    template: "%s | SDN 1 Kenanga",
  },
  description:
    "Portal utama UPTD SDN 1 Kenanga untuk informasi sekolah, pendaftaran siswa baru (SPMB) dengan sistem zonasi, dan layanan digital terintegrasi.",
  keywords: [
    "UPTD SDN 1 Kenanga",
    "sekolah dasar",
    "pendaftaran siswa baru",
    "SPMB",
    "zonasi",
    "pendidikan",
    "Indonesia",
  ],
  authors: [{ name: "UPTD SDN 1 Kenanga" }],
  creator: "Website Sekolah Terpadu",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/logo.png?v=2", sizes: "any" },
    ],
    apple: "/logo.png?v=2",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "UPTD SDN 1 Kenanga",
    title: "UPTD SDN 1 Kenanga - Website Sekolah Terpadu",
    description:
      "Portal utama UPTD SDN 1 Kenanga untuk informasi sekolah, pendaftaran siswa baru (SPMB), dan layanan digital terintegrasi.",
  },
};

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { schoolSettings } from "@/db/schema/misc";

import { auth } from "@/auth";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check Maintenance Mode
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  
  // Allow Login, API, and Maintenance page itself
  const isProtectedPath = !pathname.startsWith("/api") && !pathname.startsWith("/login") && pathname !== "/maintenance";

  if (isProtectedPath) {
     try {
         const [settings] = await db.select({ isMaintenance: schoolSettings.isMaintenance }).from(schoolSettings).limit(1);
         
         if (settings?.isMaintenance) {
             // Bypass for Admins
             const session = await auth();
             const role = session?.user?.role;
             const isAdmin = role === "admin" || role === "superadmin";
             
             if (!isAdmin) {
                 redirect("/maintenance");
             }
         }
     } catch (e) {
         // Ignore DB errors
     }
  }

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#3b82f6" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1e3a8a" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Sekolahku" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <noscript>
          <div className="p-4 text-center bg-red-100 text-red-700">
             JavaScript diperlukan untuk menjalankan aplikasi ini dengan baik. Mohon aktifkan JavaScript di browser Anda.
          </div>
        </noscript>
        <ZXingConfig />
        <SkipToContent />
        <ThemeProvider>
          <SWRProvider>
            <AuthProvider>
              <SchoolSettingsProvider>{children}</SchoolSettingsProvider>
            </AuthProvider>
          </SWRProvider>
          <Toaster />
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
