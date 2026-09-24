"use client";

import { Printer, ScanLine, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DocStationMode } from "./types";

interface ModePickerProps {
  onSelect: (mode: DocStationMode) => void;
}

/** Langkah 1: pengguna memilih alur — pindai dokumen atau cetak dokumen. */
export function ModePicker({ onSelect }: ModePickerProps) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-8 py-8">
      <div className="max-w-2xl space-y-3 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
          Selamat Datang
        </span>
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Apa yang ingin Anda lakukan hari ini?
        </h2>
        <p className="mx-auto max-w-lg text-sm font-medium text-muted-foreground sm:text-base">
          Pilih salah satu alur kerja di bawah ini untuk memulai pengelolaan dokumen.
        </p>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-6 px-2 md:grid-cols-2">
        <ModeCard
          icon={<ScanLine className="h-8 w-8" />}
          badge="Mode Scan"
          title="Memindai Dokumen"
          description="Gunakan scanner eSCL LAN untuk memindai dokumen fisik, menyunting gambar (B&W, deskew, perspective warp, despeckle), lalu menyimpan hasilnya."
          onClick={() => onSelect("scan")}
        />
        <ModeCard
          icon={<Printer className="h-8 w-8" />}
          badge="Mode Print"
          title="Mencetak Dokumen"
          description="Unggah berkas dari perangkat, atur ukuran kertas & tata letak, lalu kirim langsung ke printer jaringan (IPP atau RAW)."
          onClick={() => onSelect("print")}
        />
      </div>
    </section>
  );
}

interface ModeCardProps {
  icon: React.ReactNode;
  badge: string;
  title: string;
  description: string;
  onClick: () => void;
}

function ModeCard({ icon, badge, title, description, onClick }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start gap-5 rounded-2xl border-2 border-border bg-card p-8 text-left transition-all",
        "hover:border-primary hover:shadow-lg hover:shadow-primary/10 active:scale-[0.99]",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner transition-transform group-hover:scale-110">
          {icon}
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          {badge}
        </span>
      </div>
      <div>
        <h3 className="text-2xl font-extrabold text-foreground transition-colors group-hover:text-primary">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs font-extrabold text-primary transition-transform group-hover:translate-x-1">
        <span>Mulai</span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </button>
  );
}
