import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { SchoolSettingsProvider } from "@/lib/contexts/school-settings-context";
import { SWRProvider } from "@/components/providers/swr-provider";
import { Toaster } from "@/components/ui/toaster";
import { SkipToContent } from "@/components/accessibility";
import { ZXingConfig } from "@/components/zxing-config";
import "./globals.css";

const SITE_URL = "https://sdn1kenanga.sch.id";

// Structured data untuk rich result Google: knowledge panel sekolah,
// skor Local SEO (nama+alamat+koordinat konsisten dengan Google Business
// Profile), dan sitelinks search box.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "@id": `${SITE_URL}/#school`,
  name: "UPTD SDN 1 Kenanga",
  alternateName: ["SDN 1 Kenanga", "SD Negeri 1 Kenanga Sungai Penuh"],
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  image: `${SITE_URL}/logo.png`,
  description:
    "UPTD SDN 1 Kenanga, sekolah dasar negeri di Sungai Penuh, Jambi. Melayani pendaftaran siswa baru (SPMB), tabungan siswa, mutasi, dan layanan pendidikan lainnya.",
  identifier: {
    "@type": "PropertyValue",
    name: "NPSN",
    value: "20211091",
  },
  address: {
    "@type": "PostalAddress",
    streetAddress: "Jl. Pendidikan No. 1, Kenanga",
    addressLocality: "Sungai Penuh",
    addressRegion: "Jambi",
    postalCode: "37111",
    addressCountry: "ID",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: -2.072254,
    longitude: 101.395614,
  },
  telephone: "(0748) 123456",
  areaServed: {
    "@type": "AdministrativeArea",
    name: "Kota Sungai Penuh, Jambi",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: "SDN 1 Kenanga",
  publisher: { "@id": `${SITE_URL}/#school` },
  inLanguage: "id-ID",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SDN 1 Kenanga — SD Negeri Sungai Penuh, SPMB & Layanan Siswa",
    template: "%s | SDN 1 Kenanga Sungai Penuh",
  },
  description:
    "UPTD SDN 1 Kenanga Sungai Penuh, Jambi (NPSN 20211091). Pendaftaran siswa baru SPMB jalur domisili, cek saldo tabungan siswa, layanan mutasi, data guru & staf, serta informasi sekolah terkini.",
  keywords: [
    "SDN 1 Kenanga",
    "UPTD SDN 1 Kenanga",
    "SD Negeri Sungai Penuh",
    "pendaftaran SD Sungai Penuh",
    "SPMB SDN 1 Kenanga",
    "PPDB SD Sungai Penuh",
    "sekolah dasar Sungai Penuh",
    "SPMB",
    "NPSN 20211091",
  ],
  authors: [{ name: "UPTD SDN 1 Kenanga" }],
  creator: "UPTD SDN 1 Kenanga",
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: SITE_URL,
    siteName: "UPTD SDN 1 Kenanga",
    title: "SDN 1 Kenanga — SD Negeri Sungai Penuh, SPMB & Layanan Siswa",
    description:
      "UPTD SDN 1 Kenanga Sungai Penuh, Jambi. Pendaftaran siswa baru (SPMB) jalur domisili, layanan tabungan & mutasi siswa, dan informasi sekolah.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Logo UPTD SDN 1 Kenanga",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "SDN 1 Kenanga — SD Negeri Sungai Penuh",
    description:
      "Pendaftaran siswa baru (SPMB), layanan tabungan & mutasi siswa, dan informasi sekolah UPTD SDN 1 Kenanga Sungai Penuh.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // NOTE: Maintenance mode and session checks have been moved to client-side guards
  // to ensure compatibility with static export (output: "export").

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#3b82f6" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1e3a8a" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Sekolahku" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/*
          CSP memakai 'unsafe-inline'/'unsafe-eval' karena produksi dibangun
          dengan output:"export" (HTML statis yang ditanam di binary Go), sehingga
          nonce/per-request header tidak tersedia. Direktif di bawah tetap
          mempersempit dampak XSS: object/base/form tidak bisa disalahgunakan,
          dan frame hanya boleh dari diri sendiri.
        */}
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <div id="app-version" className="fixed bottom-1.5 right-2 z-[9999] text-[11px] font-mono text-black/20 pointer-events-none select-none print:hidden" aria-hidden="true">v1.1.015</div>
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
              (function() {
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    if (['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) {
                      navigator.serviceWorker.getRegistrations().then(function(registrations) {
                        registrations.forEach(function(registration) {
                          registration.unregister();
                        });
                      });
                      if ('caches' in window) {
                        caches.keys().then(function(keys) {
                          keys.forEach(function(key) {
                            caches.delete(key);
                          });
                        });
                      }
                      return;
                    }

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
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
