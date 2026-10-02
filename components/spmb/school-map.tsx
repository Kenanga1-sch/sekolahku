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

// Auto-fit view agar lingkaran radius selalu terlihat utuh berapapun km-nya.
// Catatan: jangan pakai L.circle(...).getBounds() — circle yang belum
// menempel ke peta tidak punya _map dan akan melempar
// "Cannot read properties of undefined (reading 'layerPointToLatLng')".
// L.latLng().toBounds() murni kalkulasi geodesik, aman tanpa map instance.
function FitBounds({ center, radiusM }: { center: [number, number]; radiusM: number }) {
  const map = useMap();

  useEffect(() => {
    if (radiusM > 0) {
      // toBounds() butuh diameter (lebar sisi kotak), bukan radius
      map.fitBounds(L.latLng(center).toBounds(radiusM * 2).pad(0.15), { animate: false });
    } else {
      map.setView(center, 15, { animate: false });
    }
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const schoolPosition: [number, number] = [lat, lng];
  const radiusM = maxDistanceKm * 1000;
  // Leaflet mengisi atribut SVG (stroke/fill) yang tidak me-resolve var() CSS —
  // baca nilai terpakai dari --primary (mengikuti tema runtime bila ada).
  const primaryColor = (() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#065F46";
  })();

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
            color: primaryColor,
            fillColor: primaryColor,
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
