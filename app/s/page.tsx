import type { Metadata } from "next";
import { Suspense } from "react";

import { SharePageClient } from "./_components/share-page-client";

// Halaman tautan berbagi publik. Route-nya statis (query ?t=<token>), sesuai
// mode `output: "export"` — token dibaca di sisi klien.
export const metadata: Metadata = {
  title: "Tautan Berbagi — Cloud Storage",
  description: "Unduh berkas yang dibagikan melalui Cloud Storage Sekolahku.",
  robots: { index: false, follow: false },
};

export default function SharePage() {
  return (
    <Suspense fallback={null}>
      <SharePageClient />
    </Suspense>
  );
}
