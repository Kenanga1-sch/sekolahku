"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";

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

// Auto-fit view agar lingkaran radius selalu terlihat utuh berapapun km-nya
function FitBounds({ center, radiusM }: { center: [number, number]; radiusM: number }) {
  const map = useMap();

  useEffect(() => {
    const circle = L.circle(center, { radius: radiusM });
    const bounds = circle.getBounds().pad(0.15);
    map.fitBounds(bounds, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], radiusM, map]);

  return null;
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#065F46] border-t-transparent" />
      </div>
    );
  }

  const schoolPosition: [number, number] = [lat, lng];
  const radiusM = maxDistanceKm * 1000;

  return (
    <MapContainer
      center={schoolPosition}
      zoom={13}
      className="h-full w-full z-0"
      scrollWheelZoom={true}
      dragging={true}
      touchZoom={true}
      doubleClickZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds center={schoolPosition} radiusM={showZoneRadius ? radiusM : 0} />

      {/* Zone Circle */}
      {showZoneRadius && (
        <Circle
          center={schoolPosition}
          radius={radiusM}
          pathOptions={{
            color: "#065F46",
            fillColor: "#065F46",
            fillOpacity: 0.08,
            dashArray: "6, 8",
            weight: 2,
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
                Radius penerimaan: {maxDistanceKm} km dari titik ini
              </p>
            )}
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
