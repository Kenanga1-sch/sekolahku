"use client";

import { useState, useEffect } from "react";
import PublicSidebar from "@/components/layout/public-sidebar";
import Footer from "@/components/layout/footer";
import { cn } from "@/lib/utils";

export default function PublicLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Restore state from local storage if needed, or default to open
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) setIsCollapsed(saved === "true");
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", String(newState));
  };

  if (!isMounted) {
    return (
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* Render static initial state to prevent hydration mismatch flickering if possible, 
            or just render a loading state if acceptable. For now, render full width default. */}
        <PublicSidebar isCollapsed={false} toggleSidebar={() => {}} />
        <div className="flex-1 flex flex-col md:pl-64 transition-all duration-300">
          <main className="flex-1 w-full pt-16 md:pt-0">{children}</main>
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="print:hidden">
        <PublicSidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
      </div>
      <div 
        className={cn(
          "flex-1 flex flex-col transition-all duration-300 ease-in-out print:pl-0 print:pt-0",
          isCollapsed ? "md:pl-[70px]" : "md:pl-64"
        )}
      >
        <main className="flex-1 w-full pt-16 md:pt-0 print:pt-0">{children}</main>
        <div className="print:hidden">
            <Footer />
        </div>
      </div>
    </div>
  );
}
