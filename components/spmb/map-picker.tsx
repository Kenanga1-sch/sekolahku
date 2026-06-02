"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { point, distance as turfDistance } from "@turf/turf";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const safeSchoolLat = typeof schoolLat === "number" && Number.isFinite(schoolLat) ? schoolLat : -2.072254;
  const safeSchoolLng = typeof schoolLng === "number" && Number.isFinite(schoolLng) ? schoolLng : 101.395614;
  const hasInitialHomePosition = typeof initialHomeLat === "number" && Number.isFinite(initialHomeLat) && typeof initialHomeLng === "number" && Number.isFinite(initialHomeLng);
  const safeInitialHomeLat = hasInitialHomePosition ? Number(initialHomeLat) : safeSchoolLat;
  const safeInitialHomeLng = hasInitialHomePosition ? Number(initialHomeLng) : safeSchoolLng;

  // State for home position
  const [homePosition, setHomePosition] = useState<Coordinates>({
    lat: safeInitialHomeLat,
    lng: safeInitialHomeLng,
  });
  const [hasSelectedLocation, setHasSelectedLocation] = useState(hasInitialHomePosition);
  const [manualLat, setManualLat] = useState(hasInitialHomePosition ? safeInitialHomeLat.toFixed(6) : "");
  const [manualLng, setManualLng] = useState(hasInitialHomePosition ? safeInitialHomeLng.toFixed(6) : "");
  
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Calculate distance
  const calculateDistance = useCallback(
    (homeLat: number, homeLng: number): number => {
      const schoolPoint = point([safeSchoolLng, safeSchoolLat]);
      const homePoint = point([homeLng, homeLat]);
      return turfDistance(schoolPoint, homePoint, { units: "kilometers" });
    },
    [safeSchoolLat, safeSchoolLng]
  );

  // Current distance
  const currentDistance = hasSelectedLocation ? calculateDistance(homePosition.lat, homePosition.lng) : null;
  const isWithinZone = currentDistance !== null && currentDistance <= maxDistanceKm;

  // Handle position change (from drag or click)
  const handlePositionChange = useCallback(
    (coords: Coordinates) => {
      setHomePosition(coords);
      setHasSelectedLocation(true);
      setManualLat(coords.lat.toFixed(6));
      setManualLng(coords.lng.toFixed(6));
      const dist = calculateDistance(coords.lat, coords.lng);
      onLocationChange(coords.lat, coords.lng, dist, dist <= maxDistanceKm);
    },
    [calculateDistance, maxDistanceKm, onLocationChange]
  );

  const handleApplyManualCoordinates = () => {
    const latText = manualLat.trim();
    const lngText = manualLng.trim();
    const lat = Number(latText);
    const lng = Number(lngText);

    if (!latText || !Number.isFinite(lat) || lat < -90 || lat > 90) {
      alert("Latitude tidak valid. Gunakan angka antara -90 sampai 90.");
      return;
    }
    if (!lngText || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      alert("Longitude tidak valid. Gunakan angka antara -180 sampai 180.");
      return;
    }

    handlePositionChange({ lat, lng });
  };
  
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

  // Initial callback on mount, only when there is an actual saved location.
  useEffect(() => {
    if (!hasSelectedLocation || currentDistance === null) return;
    onLocationChange(
      homePosition.lat,
      homePosition.lng,
      currentDistance,
      isWithinZone
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // School position
  const schoolPosition: [number, number] = [safeSchoolLat, safeSchoolLng];

  // Line between school and home
  const polylinePositions: [number, number][] = [
    schoolPosition,
    [homePosition.lat, homePosition.lng],
  ];
  const mapCenter: Coordinates = hasSelectedLocation ? homePosition : { lat: safeSchoolLat, lng: safeSchoolLng };

  return (
    <div className="space-y-4">
      {/* Instructions & GPS Button */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <Alert className="flex-1">
            <MapPin className="h-4 w-4" />
            <AlertDescription>
              Geser marker hijau, klik peta, atau gunakan tombol <strong>Cek Lokasi Saya</strong>.
              Anda juga dapat mengisi koordinat manual jika data titik rumah sudah tersedia.
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

      <div className="grid gap-3 rounded-2xl border bg-white/70 p-4 dark:bg-zinc-900/70 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="manual-lat">Latitude Rumah</Label>
          <Input
            id="manual-lat"
            inputMode="decimal"
            placeholder="-6.363876"
            value={manualLat}
            onChange={(event) => setManualLat(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-lng">Longitude Rumah</Label>
          <Input
            id="manual-lng"
            inputMode="decimal"
            placeholder="108.313036"
            value={manualLng}
            onChange={(event) => setManualLng(event.target.value)}
          />
        </div>
        <Button type="button" variant="outline" onClick={handleApplyManualCoordinates}>
          Hitung Jarak
        </Button>
      </div>

      {/* Map Container */}
      <BackgroundGradient className="rounded-3xl bg-white dark:bg-zinc-900 p-0.5">
        <Card className="overflow-hidden rounded-3xl border-none shadow-none">
            <div className="relative">
            <MapContainer
                center={[mapCenter.lat, mapCenter.lng]} 
                zoom={Number(process.env.NEXT_PUBLIC_DEFAULT_ZOOM) || 14}
                className="map-container h-[400px] w-full z-0"
                scrollWheelZoom
            >
                {/* Controller specific for view updates */}
                <MapController center={mapCenter} />

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

                {hasSelectedLocation && (
                  <DraggableMarker
                    position={homePosition}
                    onPositionChange={handlePositionChange}
                  />
                )}

                {/* Distance Line */}
                {hasSelectedLocation && (
                  <Polyline
                    positions={polylinePositions}
                    pathOptions={{
                        color: isWithinZone ? "#22c55e" : "#ef4444",
                        weight: 3,
                        dashArray: "10, 10",
                    }}
                  />
                )}

                {/* Click Handler */}
                <ClickHandler onMapClick={handlePositionChange} />
            </MapContainer>

            {/* Distance Display Overlay */}
            <div className={`distance-display ${!hasSelectedLocation ? "within-zone" : isWithinZone ? "within-zone" : "outside-zone"}`}>
                <div className="flex items-center gap-2">
                {!hasSelectedLocation ? (
                    <MapPin className="h-5 w-5 text-blue-600" />
                ) : isWithinZone ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                )}
                <div>
                    <p className="text-sm text-muted-foreground">Jarak ke sekolah:</p>
                    <p
                    className={`text-lg font-bold ${
                        !hasSelectedLocation ? "text-blue-600" : isWithinZone ? "text-green-600" : "text-red-600"
                    }`}
                    >
                    {currentDistance === null ? "Belum dihitung" : formatDistance(currentDistance)}
                    </p>
                </div>
                </div>
            </div>
            </div>
        </Card>
      </BackgroundGradient>

      {/* Zone Status Alert */}
      {hasSelectedLocation && !isWithinZone && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Peringatan:</strong> Lokasi rumah Anda berada di luar zona prioritas
            ({maxDistanceKm} km). Pendaftaran tetap dapat dilanjutkan, namun prioritas
            penerimaan akan lebih rendah.
          </AlertDescription>
        </Alert>
      )}

      {hasSelectedLocation && isWithinZone && (
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
            Sekolah: {safeSchoolLat.toFixed(6)}, {safeSchoolLng.toFixed(6)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-green-600" />
          <span>
            Rumah: {hasSelectedLocation ? `${homePosition.lat.toFixed(6)}, ${homePosition.lng.toFixed(6)}` : "Belum ditentukan"}
          </span>
        </div>
      </div>
    </div>
  );
}
