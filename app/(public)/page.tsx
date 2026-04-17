"use client";

import React, { useState, useEffect } from "react";
import { goGet } from "@/lib/api-client";
import { HomeClient } from "@/components/landing/home-client";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    goGet(`/api/public/homepage`)
      .then(json => {
        if (json && (json as any).success) {
          setData(json);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch homepage data:", err);
        setIsLoading(false);
      });
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


