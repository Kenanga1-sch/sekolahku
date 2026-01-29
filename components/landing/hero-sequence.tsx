"use client";

import { useEffect, useRef, useState } from "react";
import { useScroll, useSpring, useTransform } from "framer-motion";

interface HeroSequenceProps {
  fallbackImage?: string;
  progress?: any; // strict typing: MotionValue<number>
}

const FRAME_COUNT = 380;
const FRAME_PATH = "/images/hero-sequence/ezgif-frame-";
const FPS = 24;

export function HeroSequence({ fallbackImage, progress: externalProgress }: HeroSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const imagesRef = useRef<HTMLImageElement[]>([]);

  // Use external progress if provided, otherwise internal scroll
  const { scrollYProgress: internalScrollProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const activeProgress = externalProgress || internalScrollProgress;

  const smoothProgress = useSpring(activeProgress, {
    stiffness: 80,
    damping: 20,
    restDelta: 0.001,
  });

  // Preload Images
  useEffect(() => {
    let loadedCount = 0;
    const images: HTMLImageElement[] = [];

    const loadNextImage = (index: number) => {
      if (index > FRAME_COUNT) {
        setImagesLoaded(true);
        return;
      }

      const img = new Image();
      const paddedIndex = index.toString().padStart(3, "0");
      img.src = `${FRAME_PATH}${paddedIndex}.jpg`;
      
      img.onload = () => {
        loadedCount++;
        setLoadingProgress(Math.round((loadedCount / FRAME_COUNT) * 100));
        
        // Optimistic: Start rendering once we have enough frames (e.g., 30) for the initial view
        if (loadedCount >= 30) {
            setImagesLoaded(true); 
        }
      };

      img.onerror = (e) => {
        console.error(`Failed to load image: ${img.src}`, e);
      };

      images[index - 1] = img;
    };

    // Parallel loading strategy for faster start
    for (let i = 1; i <= FRAME_COUNT; i++) {
      loadNextImage(i);
    }
    
    imagesRef.current = images;

    return () => {
        // Cleanup if needed
    };
  }, []);


  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let lastDrawTime = 0;
    const fpsInterval = 1000 / FPS;

    const render = (timestamp: number) => {
      animationFrameId = requestAnimationFrame(render);

      // Throttle FPS
      const elapsed = timestamp - lastDrawTime;
      if (elapsed < fpsInterval) return;

      lastDrawTime = timestamp - (elapsed % fpsInterval);

      const activeVal = smoothProgress.get();
      const progressValue = typeof activeVal === 'number' ? activeVal : 0;
      // Map progress to frame index
      let frameIndex = Math.floor(progressValue * (FRAME_COUNT - 1));
      
      // Clamp
      if (frameIndex < 0) frameIndex = 0;
      if (frameIndex >= FRAME_COUNT) frameIndex = FRAME_COUNT - 1;

      const img = imagesRef.current[frameIndex];

      if (img && img.complete && img.naturalWidth > 0) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Use COVER mode: fill entire canvas while maintaining aspect ratio
        // Image will be centered and may be cropped on edges
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvasRatio = canvas.width / canvas.height;
        
        let drawWidth: number;
        let drawHeight: number;
        let offsetX: number;
        let offsetY: number;

        if (canvasRatio > imgRatio) {
          // Canvas is wider than image - scale to fill width
          drawWidth = canvas.width;
          drawHeight = drawWidth / imgRatio;
        } else {
          // Canvas is taller than image - scale to fill height
          drawHeight = canvas.height;
          drawWidth = drawHeight * imgRatio;
        }
        
        // Center the image perfectly
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = (canvas.height - drawHeight) / 2;

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      }
    };

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      // Match canvas to parent container exactly (1:1 pixel ratio for simplicity)
      // This ensures consistent appearance across all zoom levels
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      
      // CSS: fill container
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    
    // Start loop
    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [smoothProgress, imagesLoaded]); 

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full -z-10 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
      <canvas 
          ref={canvasRef} 
          className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${imagesLoaded ? "opacity-100" : "opacity-0"}`}
      />
      
      {/* Loading Indicator - Show on desktop only or until fallback loads */}
      {/* Loading Indicator - Show until loaded */}
      {!imagesLoaded && (
         <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-white z-20">
            <div className="flex flex-col items-center gap-4">
                <div className="h-1 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-100" style={{ width: `${loadingProgress}%` }} />
                </div>
                <p className="text-xs text-zinc-500 font-mono">Memuat Visual {loadingProgress}%</p>
            </div>
         </div>
      )}

      {/* Overlay Gradient for Text Readability - LIGHT MODE FIXED */}
      {/* Reduced opacity in light mode to ensure images are visible */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/20 to-zinc-50 dark:from-zinc-950/80 dark:via-zinc-950/40 dark:to-zinc-950 pointer-events-none" />
    </div>
  );
}
