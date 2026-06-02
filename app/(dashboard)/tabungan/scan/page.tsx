import { UnifiedQRWorkbench } from "@/components/scan/unified-qr-workbench";

export default function TabunganScanPage() {
  return (
    <UnifiedQRWorkbench
      backHref="/tabungan"
      backLabel="Tabungan Siswa"
      title="Scan QR Tabungan & Presensi"
      description="Gunakan layar yang sama untuk setoran tabungan. Jika QR milik siswa dan sesi presensi aktif, kehadiran ikut tercatat otomatis."
    />
  );
}
