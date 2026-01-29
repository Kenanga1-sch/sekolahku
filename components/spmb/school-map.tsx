"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Import Leaflet CSS
import "leaflet/dist/leaflet.css";

// Re-use standard markers
const schoolIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface SchoolMapProps {
  lat: number;
  lng: number;
  maxDistanceKm: number;
  schoolName: string;
  showZoneRadius?: boolean;
}

export default function SchoolMap({
  lat,
  lng,
  maxDistanceKm,
  schoolName,
  showZoneRadius = true,
}: SchoolMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const schoolPosition: [number, number] = [lat, lng];

  return (
    <MapContainer
      center={schoolPosition}
      zoom={13}
      className="h-full w-full"
      scrollWheelZoom={true} // Enable scroll zoom for smoother experience
      dragging={true}
      touchZoom={true}
      doubleClickZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Zone Circle */}
      {showZoneRadius && (
        <Circle
          center={schoolPosition}
          radius={maxDistanceKm * 1000} // Convert km to meters
          pathOptions={{
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.1,
            dashArray: "5, 5",
          }}
        />
      )}

      {/* School Marker */}
      <Marker position={schoolPosition} icon={schoolIcon}>
        <Popup>
          <div className="text-center">
            <strong>{schoolName}</strong>
            {showZoneRadius && (
              <p className="text-xs text-muted-foreground mt-1">
                Radius zonasi: {maxDistanceKm} km
              </p>
            )}
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
