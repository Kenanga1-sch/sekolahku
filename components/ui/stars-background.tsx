"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface StarsBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  starDensity?: "low" | "medium" | "high";
}

export const StarsBackground = ({
  className,
  starDensity: _starDensity = "medium",
  ...props
}: StarsBackgroundProps) => {
  return (
    <div
      className={cn(
        "stars-container absolute inset-0 overflow-hidden pointer-events-none",
        className
      )}
      {...props}
    >
      <div id="stars" className="stars-layer stars-small" />
      <div id="stars2" className="stars-layer stars-medium" />
      <div id="stars3" className="stars-layer stars-large" />
    </div>
  );
};
