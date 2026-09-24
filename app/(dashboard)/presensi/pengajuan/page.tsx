"use client";

/**
 * Halaman mandiri Pengajuan Izin / Sakit.
 *
 * Konten sebenarnya ada di PengajuanIzinTab (dipakai juga sebagai tab di
 * halaman Presensi). Route ini dipertahankan agar tautan notifikasi push
 * yang sudah terkirim (mis. "leave-<id>") tetap berfungsi.
 */

import { PengajuanIzinTab } from "../_components/pengajuan-izin-tab";

export default function PengajuanIzinPage() {
  return <PengajuanIzinTab />;
}
