"use client";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const BackgroundBeams = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "absolute inset-0 w-full h-full bg-transparent overflow-hidden touch-none pointer-events-none",
        className
      )}
    >
      <div
        className="absolute w-full h-[100%] z-0"
      >
        <svg
          className="absolute inset-0 w-full h-[100%] block opacity-40 mix-blend-overlay"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          <path
            fill="url(#grad2)"
            d="M0,0 L1440,0 L1440,900 L0,900 Z"
          />
          <defs>
             <radialGradient id="grad2" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" style={{stopColor:"var(--primary)", stopOpacity:0.3}} />
                <stop offset="100%" style={{stopColor:"transparent", stopOpacity:0}} />
            </radialGradient>
          </defs>
        </svg>

        {/* Animated Paths */}
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 w-full h-full"
        >
             {/* Creating multiple beams with different delays and durations */}
            {Array.from({ length: 12 }).map((_, i) => (
                <Beam key={i} index={i} />
            ))}
        </motion.div>
      </div>
    </div>
  );
};

const Beam = ({ index }: { index: number }) => {
    // Randomize slightly
    const randomDelay = Math.random() * 5;
    const randomDuration = 10 + Math.random() * 10;
    const initialX = Math.random() * 100;

    return (
        <motion.div
            className="absolute top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-primary/50 to-transparent"
            style={{
                left: `${(index / 12) * 100}%`,
            }}
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: "100%", opacity: [0, 1, 0] }}
            transition={{
                duration: randomDuration,
                repeat: Infinity,
                delay: randomDelay,
                ease: "linear",
            }}
        />
    );
}
