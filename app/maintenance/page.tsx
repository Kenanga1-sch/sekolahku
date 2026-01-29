
import { AlertTriangle, Hammer } from "lucide-react";

export default function MaintenancePage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-900 text-center">
            <div className="bg-white dark:bg-zinc-800 p-8 rounded-2xl shadow-xl max-w-lg w-full border border-zinc-200 dark:border-zinc-700">
                <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Hammer className="h-10 w-10 text-amber-600 dark:text-amber-500" />
                </div>
                
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                    Mode Pemeliharaan
                </h1>
                
                <p className="text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">
                    Mohon maaf, sistem sedang dalam perbaikan rutin atau pembaruan mendesak. 
                    Kami akan segera kembali. Silakan coba beberapa saat lagi.
                </p>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-zinc-100 dark:bg-zinc-900/50 p-2 rounded">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Akses publik ditutup sementara oleh Administrator.</span>
                </div>
            </div>
        </div>
    );
}
