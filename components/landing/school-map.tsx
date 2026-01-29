"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@/styles/leaflet-custom.css";

// Fix Leaflet default marker icon issue in Next.js
// We use the same fix as in map-picker.tsx
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
  schoolName?: string;
}

// Controller to handle map invalidation and recentering
import { useMap } from "react-leaflet";
function MapController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();

  useEffect(() => {
    // Invalidate size in case container resized
    map.invalidateSize();
    // Fly to new coordinates with animation
    map.flyTo([lat, lng], 15, {
        animate: true,
        duration: 1.5
    });
  }, [map, lat, lng]);

  return null;
}

export default function SchoolMap({ lat, lng, schoolName = "Sekolah" }: SchoolMapProps) {
  // Ensure valid coordinates
  const validLat = typeof lat === 'number' && !isNaN(lat) ? lat : -2.072254;
  const validLng = typeof lng === 'number' && !isNaN(lng) ? lng : 101.395614;

  // Force remount when school changes
  const mapKey = `map-${validLat}-${validLng}`;

  return (
    <div className="absolute inset-0 w-full h-full">
        <MapContainer
        key={mapKey}
        center={[validLat, validLng]}
        zoom={15}
        className="h-full w-full" 
        scrollWheelZoom={false}
        dragging={false} // Static view
        zoomControl={true}
        >
        <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController lat={validLat} lng={validLng} />
        
        <Marker position={[validLat, validLng]} icon={schoolIcon}>
            <Popup>
            <div className="text-center text-zinc-900">
                <strong>{schoolName}</strong>
                <p className="text-xs text-muted-foreground mt-1">
                Lokasi Sekolah
                </p>
            </div>
            </Popup>
        </Marker>
        </MapContainer>
    </div>
  );
}
