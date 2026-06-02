"use client";

import dynamic from "next/dynamic";
import { UseFormReturn } from "react-hook-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const errors = form.formState.errors;

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
      {(errors.home_lat || errors.home_lng || errors.distance_to_school) && (
        <Alert variant="destructive">
          <AlertDescription>
            {errors.distance_to_school?.message ||
              errors.home_lat?.message ||
              errors.home_lng?.message ||
              "Tentukan titik rumah dan hitung jarak terlebih dahulu."}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
