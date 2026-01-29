"use client";

import { useEffect } from "react";
import { setZXingModuleOverrides } from "barcode-detector";

export function ZXingConfig() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      setZXingModuleOverrides({
        locateFile: (path: string, prefix: string) => {
          if (path.endsWith(".wasm")) {
            return `/wasm/${path}`;
          }
          return prefix + path;
        },
      });
    }
  }, []);

  return null;
}
