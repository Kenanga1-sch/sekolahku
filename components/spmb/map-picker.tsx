"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { point, distance as turfDistance } from "@turf/turf";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MapPin, School, AlertTriangle, CheckCircle, Crosshair } from "lucide-react";
import { formatDistance } from "@/lib/utils";
import type { MapPickerProps, Coordinates } from "@/types";
import { BackgroundGradient } from "@/components/ui/background-gradient";

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
// Map Controller Component (Handling View Updates)
// ==========================================

function MapController({ center }: { center: Coordinates }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([center.lat, center.lng], map.getZoom());
  }, [center, map]);

  return null;
}

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
    lat: initialHomeLat || schoolLat + 0.005,
    lng: initialHomeLng || schoolLng + 0.005,
  });
  
  const [isGettingLocation, setIsGettingLocation] = useState(false);

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
  
  // GPS Handler
  const handleGetCurrentLocation = () => {
      if (!navigator.geolocation) {
          alert("Browser Anda tidak mendukung fitur Geolocation.");
          return;
      }
      
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
          (position) => {
              const { latitude, longitude } = position.coords;
              handlePositionChange({ lat: latitude, lng: longitude });
              setIsGettingLocation(false);
          },
          (error) => {
              console.error("Geolocation error:", error);
              let msg = "Gagal mengambil lokasi.";
              if (error.code === 1) msg += " Mohon izinkan akses lokasi di browser.";
              else if (error.code === 2) msg += " Sinyal GPS tidak tersedia.";
              else if (error.code === 3) msg += " Waktu request habis.";
              alert(msg);
              setIsGettingLocation(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
  }

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
      {/* Instructions & GPS Button */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <Alert className="flex-1">
            <MapPin className="h-4 w-4" />
            <AlertDescription>
              Geser marker hijau, klik peta, atau gunakan tombol <strong>Cek Lokasi Saya</strong>.
            </AlertDescription>
          </Alert>
          
          <Button 
            variant="default" 
            size="lg" 
            className="w-full md:w-auto gap-2 bg-blue-600 hover:bg-blue-700"
            onClick={handleGetCurrentLocation}
            disabled={isGettingLocation}
            type="button"
          >
              <Crosshair className={`h-4 w-4 ${isGettingLocation ? "animate-spin" : ""}`} />
              {isGettingLocation ? "Mencari Lokasi..." : "Cek Lokasi Saya"}
          </Button>
      </div>

      {/* Map Container */}
      <BackgroundGradient className="rounded-3xl bg-white dark:bg-zinc-900 p-0.5">
        <Card className="overflow-hidden rounded-3xl border-none shadow-none">
            <div className="relative">
            <MapContainer
                center={[homePosition.lat, homePosition.lng]} 
                zoom={Number(process.env.NEXT_PUBLIC_DEFAULT_ZOOM) || 14}
                className="map-container h-[400px] w-full z-0"
                scrollWheelZoom
            >
                {/* Controller specific for view updates */}
                <MapController center={homePosition} />

                <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Zone Circle */}
                <Circle
                center={schoolPosition}
                radius={maxDistanceKm * 1000}
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
      </BackgroundGradient>

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
