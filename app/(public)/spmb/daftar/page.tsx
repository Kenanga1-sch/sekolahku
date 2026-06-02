"use client";

import React, { useState, useEffect } from "react";
import { RegistrationPageClient } from "@/components/spmb/registration-page-client";
import { siteConfig } from "@/lib/config";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RegistrationPage() {
  const [landingData, setLandingData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/public/spmb/landing`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setLandingData(json);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch settings for registration:", err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Use DB settings or fallback to siteConfig
  const settings = landingData?.settings;
  const isOpen = Boolean(landingData?.isOpen);
  const schoolLat = settings?.schoolLat ?? settings?.school_lat ?? siteConfig.location.lat;
  const schoolLng = settings?.schoolLng ?? settings?.school_lng ?? siteConfig.location.lng;
  const maxDistanceKm = settings?.maxDistanceKm ?? settings?.max_distance_km ?? siteConfig.location.maxDistanceKm;

  if (!isOpen) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="bg-gradient-to-r from-zinc-700 to-zinc-900 text-white pt-20 pb-8">
          <div className="container">
            <Link href="/spmb">
              <Button variant="ghost" className="text-white hover:bg-white/10 mb-4 -ml-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold">Pendaftaran SPMB Ditutup</h1>
          </div>
        </div>
        <div className="container py-12">
          <Card className="max-w-xl mx-auto">
            <CardContent className="py-10 text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Lock className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Formulir belum dapat diakses</h2>
                <p className="text-muted-foreground mt-2">
                  Pendaftaran sedang ditutup atau periode aktif belum berada dalam rentang tanggal pendaftaran.
                </p>
              </div>
              <Link href="/spmb">
                <Button>Kembali ke halaman SPMB</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <RegistrationPageClient 
      schoolLat={schoolLat} 
      schoolLng={schoolLng} 
      maxDistanceKm={maxDistanceKm} 
    />
  );
}


