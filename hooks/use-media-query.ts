"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    // Sync in case the initial state was computed on the server or the query changed
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener("change", onChange);
    return () => mediaQueryList.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

// Aligns with the mobile breakpoint used by the dashboard shell (bottom nav, sidebar drawer)
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
