"use client";

import dynamic from "next/dynamic";
import { UseFormReturn } from "react-hook-form";
import { Skeleton } from "@/components/ui/skeleton";
import type { LocationFormValues } from "@/lib/validations/spmb";

// Dynamic import MapPicker to avoid SSR issues with Leaflet
const MapPicker = dynamic(() => import("./map-picker"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-[400px] w-full rounded-lg" />
      <div className="flex gap-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-10 w-1/2" />
      </div>
    </div>
  ),
});

interface LocationFormProps {
  form: UseFormReturn<LocationFormValues>;
  schoolLat: number;
  schoolLng: number;
  maxDistanceKm: number;
  onLocationChange: (
    lat: number,
    lng: number,
    distance: number,
    isWithinZone: boolean
  ) => void;
}

export default function LocationForm({
  form,
  schoolLat,
  schoolLng,
  maxDistanceKm,
  onLocationChange,
}: LocationFormProps) {
  const values = form.getValues();

  return (
    <div className="space-y-4">
      <MapPicker
        schoolLat={schoolLat}
        schoolLng={schoolLng}
        maxDistanceKm={maxDistanceKm}
        initialHomeLat={values.home_lat}
        initialHomeLng={values.home_lng}
        onLocationChange={onLocationChange}
      />
    </div>
  );
}
