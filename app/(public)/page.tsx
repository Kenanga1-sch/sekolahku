"use client";

import React, { useState, useEffect } from "react";
import { goGet } from "@/lib/api-client";
import { HomeClient } from "@/components/landing/home-client";
import { Loader2 } from "lucide-react";

const fallbackHomepageData = {
  settings: {
    school_name: "UPTD SDN 1 Kenanga",
    school_address: "Jl. Perindustrian Blok Dukuh Desa Kenanga Kecamatan Sindang Kabupaten Indramayu",
    school_email: "uptdsdn1kenangasindang@gmail.com",
    school_lat: -6.363808728459313,
    school_lng: 108.31316062808077,
    max_distance_km: 1,
    spmb_is_open: true,
    current_academic_year: "2025/2026",
  },
  news: [],
  activePeriod: null,
  stats: {
    studentCount: 0,
  },
};

export default function HomePage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const timeoutId = window.setTimeout(() => {
      if (!isMounted) return;
      setData(fallbackHomepageData);
      setIsLoading(false);
    }, 6000);

    goGet(`/api/public/homepage`, { skipRetry: true })
      .then(json => {
        if (!isMounted) return;
        if (json && (json as any).success) {
          setData(json);
        } else {
          setData(fallbackHomepageData);
        }
        window.clearTimeout(timeoutId);
        setIsLoading(false);
      })
      .catch(err => {
        if (!isMounted) return;
        console.error("Failed to fetch homepage data:", err);
        setData(fallbackHomepageData);
        window.clearTimeout(timeoutId);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (isLoading || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <HomeClient
      settings={data.settings}
      news={data.news || []}
      activePeriod={data.activePeriod}
      studentCount={data.stats.studentCount || 0}
    />
  );
}


