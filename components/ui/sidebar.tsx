"use client";
import React, { useState, createContext, useContext, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as any)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <>
      <motion.div
        className={cn(
          "hidden h-full w-64 flex-shrink-0 flex-col border-r border-line/60 bg-surface px-3 pb-4 pt-5 md:flex lg:px-4",
          className
        )}
        animate={{
          width: animate ? (open ? "256px" : "64px") : "256px",
        }}
        onMouseEnter={animate ? () => setOpen(true) : undefined}
        onMouseLeave={animate ? () => setOpen(false) : undefined}
        {...props}
      >
        {children as any}
      </motion.div>
    </>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen } = useSidebar();
  return (
    <div className="md:hidden">
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px]"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            />
            {/* Drawer Panel / Bottom Sheet */}
            <motion.div
              initial={{ y: "100vh" }}
              animate={{ y: 0 }}
              exit={{ y: "100vh" }}
              transition={{
                duration: 0.3,
                ease: [0.32, 0.72, 0, 1],
              }}
              className={cn(
                "fixed bottom-0 left-0 right-0 z-[100] h-[85vh] w-full",
                "rounded-t-3xl border-t border-line/60 bg-surface",
                "shadow-[0_-12px_40px_rgba(4,34,43,0.16)]",
                "flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]",
                className
              )}
              {...props}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-line/60 px-5 pb-3 pt-5">
                <span className="text-sm font-semibold text-foreground">Menu Navigasi</span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Tutup menu"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 pb-24">
                {children as any}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
  props?: LinkProps;
  onClick?: () => void;
}) => {
  const { open, animate } = useSidebar();
  const pathname = usePathname();
  const isActive =
    link.href === "/overview"
      ? pathname === "/overview"
      : pathname === link.href || pathname.startsWith(`${link.href}/`);

  return (
    <Link
      href={link.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group/sidebar -mx-2 flex min-h-11 items-center justify-start gap-2.5 rounded-lg px-2 py-2 transition-colors md:min-h-0",
        isActive
          ? "bg-surface-muted font-semibold text-primary"
          : "text-foreground/80 hover:bg-surface-muted/70 hover:text-foreground",
        className
      )}
      onClick={props?.onClick || ((props as any)?.onClick)}
      {...props}
    >
      {link.icon}

      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="m-0 inline-block min-w-0 truncate whitespace-pre !p-0 text-sm transition-colors duration-150 group-hover/sidebar:translate-x-0.5"
      >
        {link.label}
      </motion.span>
    </Link>
  );
};

// Add LinkProps type if not present or just use any
type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement>;
