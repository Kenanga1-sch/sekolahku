"use client";

import { Component, type ReactNode } from "react";
import { MapPin } from "lucide-react";

/**
 * Error boundary khusus peta.
 *
 * Menyelimpan React dari error runtime Leaflet (misal tile CDN down,
 * WebGL/canvas bermasalah, atau bug internal library) supaya satu widget
 * yang gagal tidak mengganti seluruh halaman dengan global error page.
 * Jika peta gagal, pengguna tetap melihat kartu info + link Google Maps.
 */
export class MapErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Tetap catat di konsol untuk keperluan debugging produksi
    console.error("[SchoolMap] gagal merender peta:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground p-6 text-center">
            <MapPin className="h-6 w-6" />
            <p className="text-sm font-medium">Peta tidak dapat dimuat</p>
            <p className="text-xs">Gunakan tautan Google Maps di samping untuk melihat lokasi sekolah.</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
