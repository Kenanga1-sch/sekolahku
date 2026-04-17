"use client";

import React, { useState, useEffect } from "react";
import { RegistrationPageClient } from "@/components/spmb/registration-page-client";
import { siteConfig } from "@/lib/config";
import { Loader2 } from "lucide-react";

export default function RegistrationPage() {
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/public/spmb/landing`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setSettings(json.settings);
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
  const schoolLat = settings?.schoolLat ?? siteConfig.location.lat;
  const schoolLng = settings?.schoolLng ?? siteConfig.location.lng;
  const maxDistanceKm = settings?.maxDistanceKm ?? siteConfig.location.maxDistanceKm;

  return (
    <RegistrationPageClient 
      schoolLat={schoolLat} 
      schoolLng={schoolLng} 
      maxDistanceKm={maxDistanceKm} 
    />
  );
}


