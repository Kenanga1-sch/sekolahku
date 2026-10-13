"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ChevronRight } from "lucide-react";

export function SecurityTipsCard() {
  return (
            <Card className="border-slate-200/80 dark:border-zinc-800/80 shadow-xs bg-white dark:bg-zinc-950 h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                        <Shield className="h-4.5 w-4.5 text-violet-500" />
                        Tips Keamanan Akun
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-3.5">
                    <div className="flex gap-2">
                        <ChevronRight className="h-4 w-4 text-violet-500 shrink-0" />
                        <span>Gunakan kombinasi huruf besar, angka, dan simbol pada password baru Anda.</span>
                    </div>
                    <div className="flex gap-2">
                        <ChevronRight className="h-4 w-4 text-violet-500 shrink-0" />
                        <span>Ganti sandi secara berkala minimal 3 bulan sekali.</span>
                    </div>
                    <div className="flex gap-2">
                        <ChevronRight className="h-4 w-4 text-violet-500 shrink-0" />
                        <span>Hindari menggunakan password yang sama dengan website/akun media sosial lain.</span>
                    </div>
                    <div className="flex gap-2">
                        <ChevronRight className="h-4 w-4 text-violet-500 shrink-0" />
                        <span>Jangan membagikan kredensial login atau email verifikasi akun Sekolahku kepada siapa pun.</span>
                    </div>
                </CardContent>
            </Card>
  );
}
