"use client";

import { Component, type ReactNode } from "react";
import { CloudOff } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary khusus Cloud Storage.
 *
 * Mencegah satu error render (mis. data berkas tak terduga dari backend)
 * merobohkan seluruh halaman dasbor. Pengguna melihat kartu pemulihan dengan
 * tombol "Coba lagi" (reset state boundary).
 *
 * Catatan: Next.js `error.tsx` tidak berfungsi pada mode `output: "export"`
 * (static export tanpa server), sehingga boundary client ini dipakai di
 * dalam halaman sebagai gantinya.
 */
export class CloudErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[CloudStorage] gagal merender:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
            <CloudOff className="h-6 w-6 text-rose-600" />
          </div>
          <h2 className="text-lg font-semibold">Cloud Storage gagal dimuat</h2>
          <p className="text-sm text-neutral-500">
            Terjadi kesalahan saat menampilkan penyimpanan. Coba muat ulang bagian ini.
          </p>
          <Button onClick={() => this.setState({ hasError: false })}>Coba lagi</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
