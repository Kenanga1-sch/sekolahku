import { Metadata } from "next";
import CashFlowManager from "@/components/finance/cash-flow-manager";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Manajemen Arus Kas & Keuangan",
  description: "Kelola pemasukan, pengeluaran, dan mutasi dana sekolah.",
};

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Arus Kas & Mutasi</h3>
        <p className="text-sm text-muted-foreground">
          Sistem pencatatan keuangan tersentralisasi (Cash Basis).
        </p>
      </div>
      <Separator />
      <CashFlowManager />
    </div>
  );
}
