"use client";

import { CloudStorageApp } from "./_components/cloud-storage-app";
import { CloudErrorBoundary } from "./_components/cloud-error-boundary";

/**
 * Cloud Storage — penyimpanan berkas pribadi per pengguna.
 *
 * Modul React native bertema Sekolahku. Backend penyimpanan: Telegram Bot API
 * lokal (metadata di SQLite Sekolahku). Setiap pengguna memiliki ruang
 * terpisah yang terisolasi di server.
 */
export default function CloudStoragePage() {
  return (
    <CloudErrorBoundary>
      <CloudStorageApp />
    </CloudErrorBoundary>
  );
}
