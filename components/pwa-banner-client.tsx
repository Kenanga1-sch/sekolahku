"use client";

import dynamic from "next/dynamic";

const PwaInstallBanner = dynamic(
  () => import("@/components/pwa-install-banner").then((m) => m.PwaInstallBanner),
  { ssr: false },
);

export function PwaBannerClient() {
  return <PwaInstallBanner />;
}
