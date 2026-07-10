import { UnifiedQRWorkbench } from "@/components/scan/unified-qr-workbench";

export default function ScanPresensiPage() {
  return (
    <UnifiedQRWorkbench
      backHref="/presensi"
      backLabel="Presensi"
      title="Scan Harian Kelas"
      description="Siswa scan kartu untuk presensi, lalu petugas langsung memilih nominal tabungan atau melewati setoran."
      variant="presensi"
    />
  );
}
