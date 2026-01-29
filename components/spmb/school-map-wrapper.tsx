"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const SchoolMap = dynamic(() => import("./school-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-muted animate-pulse flex items-center justify-center text-muted-foreground gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Memuat Peta...</span>
    </div>
  ),
});

interface SchoolMapWrapperProps {
  lat: number;
  lng: number;
  maxDistanceKm: number;
  schoolName: string;
  showZoneRadius?: boolean;
}

export default function SchoolMapWrapper(props: SchoolMapWrapperProps) {
  return <SchoolMap {...props} />;
}
