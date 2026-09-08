"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

// Kurva ease-out kuat ala Emil Kowalski — cepat di awal, melunak di akhir.
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Muncul sekali saat masuk layar. Mulai dari 97% + transparan, bukan dari nol. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y, scale: 0.97 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={{ duration: reduce ? 0.2 : 0.5, delay: reduce ? 0 : delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
