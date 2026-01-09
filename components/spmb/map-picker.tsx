"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { point, distance as turfDistance } from "@turf/turf";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, School, AlertTriangle, CheckCircle } from "lucide-react";
import { formatDistance } from "@/lib/utils";
import type { MapPickerProps, Coordinates } from "@/types";

// Import Leaflet CSS
import "leaflet/dist/leaflet.css";
import "@/styles/leaflet-custom.css";

// Fix Leaflet default marker icon issue in Next.js
const schoolIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const homeIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// ==========================================
// Draggable Marker Component
// ==========================================

interface DraggableMarkerProps {
  position: Coordinates;
  onPositionChange: (coords: Coordinates) => void;
}

function DraggableMarker({ position, onPositionChange }: DraggableMarkerProps) {
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const latlng = marker.getLatLng();
        onPositionChange({ lat: latlng.lat, lng: latlng.lng });
      }
    },
  };

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={[position.lat, position.lng]}
      ref={markerRef}
      icon={homeIcon}
    >
      <Popup>
        <div className="text-center">
          <strong>📍 Lokasi Rumah</strong>
          <p className="text-xs text-muted-foreground mt-1">
            Geser marker ini ke lokasi rumah Anda
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

// ==========================================
// Click Handler Component
// ==========================================

interface ClickHandlerProps {
  onMapClick: (coords: Coordinates) => void;
}

function ClickHandler({ onMapClick }: ClickHandlerProps) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// ==========================================
// Main MapPicker Component
// ==========================================

export default function MapPicker({
  schoolLat,
  schoolLng,
  maxDistanceKm,
  initialHomeLat,
  initialHomeLng,
  onLocationChange,
}: MapPickerProps) {
  // State for home position
  const [homePosition, setHomePosition] = useState<Coordinates>({
    lat: initialHomeLat || schoolLat + 0.005, // Slightly offset from school
    lng: initialHomeLng || schoolLng + 0.005,
  });

  // Calculate distance
  const calculateDistance = useCallback(
    (homeLat: number, homeLng: number): number => {
      const schoolPoint = point([schoolLng, schoolLat]);
      const homePoint = point([homeLng, homeLat]);
      return turfDistance(schoolPoint, homePoint, { units: "kilometers" });
    },
    [schoolLat, schoolLng]
  );

  // Current distance
  const currentDistance = calculateDistance(homePosition.lat, homePosition.lng);
  const isWithinZone = currentDistance <= maxDistanceKm;

  // Handle position change (from drag or click)
  const handlePositionChange = useCallback(
    (coords: Coordinates) => {
      setHomePosition(coords);
      const dist = calculateDistance(coords.lat, coords.lng);
      onLocationChange(coords.lat, coords.lng, dist, dist <= maxDistanceKm);
    },
    [calculateDistance, maxDistanceKm, onLocationChange]
  );

  // Initial callback on mount
  useEffect(() => {
    onLocationChange(
      homePosition.lat,
      homePosition.lng,
      currentDistance,
      isWithinZone
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // School position
  const schoolPosition: [number, number] = [schoolLat, schoolLng];

  // Line between school and home
  const polylinePositions: [number, number][] = [
    schoolPosition,
    [homePosition.lat, homePosition.lng],
  ];

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <Alert>
        <MapPin className="h-4 w-4" />
        <AlertDescription>
          <strong>Petunjuk:</strong> Klik pada peta atau geser marker hijau ke lokasi rumah Anda.
          Jarak akan dihitung otomatis.
        </AlertDescription>
      </Alert>

      {/* Map Container */}
      <Card className="overflow-hidden">
        <div className="relative">
          <MapContainer
            center={schoolPosition}
            zoom={Number(process.env.NEXT_PUBLIC_DEFAULT_ZOOM) || 14}
            className="map-container"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Zone Circle */}
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

            {/* School Marker (Fixed) */}
            <Marker position={schoolPosition} icon={schoolIcon}>
              <Popup>
                <div className="text-center">
                  <strong>🏫 Lokasi Sekolah</strong>
                  <p className="text-xs text-muted-foreground mt-1">
                    Radius zonasi: {maxDistanceKm} km
                  </p>
                </div>
              </Popup>
            </Marker>

            {/* Home Marker (Draggable) */}
            <DraggableMarker
              position={homePosition}
              onPositionChange={handlePositionChange}
            />

            {/* Distance Line */}
            <Polyline
              positions={polylinePositions}
              pathOptions={{
                color: isWithinZone ? "#22c55e" : "#ef4444",
                weight: 3,
                dashArray: "10, 10",
              }}
            />

            {/* Click Handler */}
            <ClickHandler onMapClick={handlePositionChange} />
          </MapContainer>

          {/* Distance Display Overlay */}
          <div
            className={`distance-display ${
              isWithinZone ? "within-zone" : "outside-zone"
            }`}
          >
            <div className="flex items-center gap-2">
              {isWithinZone ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className="text-sm text-muted-foreground">Jarak ke sekolah:</p>
                <p
                  className={`text-lg font-bold ${
                    isWithinZone ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatDistance(currentDistance)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Zone Status Alert */}
      {!isWithinZone && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Peringatan:</strong> Lokasi rumah Anda berada di luar zona prioritas
            ({maxDistanceKm} km). Pendaftaran tetap dapat dilanjutkan, namun prioritas
            penerimaan akan lebih rendah.
          </AlertDescription>
        </Alert>
      )}

      {isWithinZone && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Dalam Zona:</strong> Lokasi rumah Anda berada dalam radius zonasi.
            Anda mendapat prioritas dalam proses seleksi.
          </AlertDescription>
        </Alert>
      )}

      {/* Coordinate Info (for debugging/verification) */}
      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <School className="h-4 w-4 text-blue-600" />
          <span>
            Sekolah: {schoolLat.toFixed(6)}, {schoolLng.toFixed(6)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-green-600" />
          <span>
            Rumah: {homePosition.lat.toFixed(6)}, {homePosition.lng.toFixed(6)}
          </span>
        </div>
      </div>
    </div>
  );
}
