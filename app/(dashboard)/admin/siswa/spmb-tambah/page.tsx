"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RegistrationPageClient } from "@/components/spmb/registration-page-client";
import { siteConfig } from "@/lib/config";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Input data pendaftar SPMB oleh panitia/admin.
 *
 * SPMB kini info-only untuk orang tua: pendaftaran dilakukan di sekolah
 * dengan membawa dokumen lengkap, dan data diisikan oleh panitia (role
 * staff) atau admin lewat halaman ini. Wizard 5-langkahnya sama dengan
 * yang dulu dipakai ortu secara online — hanya endpoint-nya yang pindah
 * ke /api/spmb/registrants (terautentikasi).
 */
export default function SPMBTambahPage() {
  const [schoolData, setSchoolData] = useState<{
    lat: number;
    lng: number;
    maxDistanceKm: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/public/spmb/landing")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          const s = json.settings;
          setSchoolData({
            lat: s?.schoolLat ?? s?.school_lat ?? siteConfig.location.lat,
            lng: s?.schoolLng ?? s?.school_lng ?? siteConfig.location.lng,
            maxDistanceKm:
              s?.maxDistanceKm ??
              s?.max_distance_km ??
              siteConfig.location.maxDistanceKm,
          });
        } else {
          setSchoolData({
            lat: siteConfig.location.lat,
            lng: siteConfig.location.lng,
            maxDistanceKm: siteConfig.location.maxDistanceKm,
          });
        }
      })
      .catch(() => {
        setSchoolData({
          lat: siteConfig.location.lat,
          lng: siteConfig.location.lng,
          maxDistanceKm: siteConfig.location.maxDistanceKm,
        });
      });
  }, []);

  if (!schoolData) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 -mx-4 sm:-mx-6 lg:-mx-8 -my-6">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white pt-8 pb-8">
        <div className="container px-4 sm:px-6 lg:px-8">
          <Link href="/admin/siswa?tab=spmb">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10 mb-4 -ml-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali ke Daftar Pendaftar
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            Input Data Pendaftar SPMB
          </h1>
          <p className="text-white/90 mt-2 text-sm md:text-base">
            Isi data calon siswa berdasarkan dokumen yang dibawa orang tua ke sekolah.
          </p>
        </div>
      </div>
      <RegistrationPageClient
        schoolLat={schoolData.lat}
        schoolLng={schoolData.lng}
        maxDistanceKm={schoolData.maxDistanceKm}
        variant="staff"
      />
    </div>
  );
}
