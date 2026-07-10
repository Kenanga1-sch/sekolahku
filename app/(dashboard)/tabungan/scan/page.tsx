import { UnifiedQRWorkbench } from "@/components/scan/unified-qr-workbench";

export default function TabunganScanPage() {
  return (
    <UnifiedQRWorkbench
      backHref="/tabungan"
      backLabel="Tabungan Siswa"
      title="Scan QR Tabungan"
      description="Scan kartu siswa untuk setoran tabungan. (Kehadiran otomatis tercatat jika sesi kelas aktif)."
      variant="tabungan"
    />
  );
}
