"use client";
import React, { useState, createContext, useContext, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconMenu2, IconX } from "@tabler/icons-react";
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
          "h-full px-3 lg:px-4 py-4 hidden md:flex md:flex-col bg-neutral-100 dark:bg-neutral-800 w-[280px] xl:w-[300px] flex-shrink-0",
          className
        )}
        animate={{
          width: animate ? (open ? "min(300px, 24vw)" : "64px") : "min(300px, 24vw)",
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
                "fixed bottom-0 left-0 right-0 z-[100] w-full h-[85vh]",
                "bg-white dark:bg-neutral-900 rounded-t-3xl",
                "shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)]",
                "flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]",
                className
              )}
              {...props}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Menu Navigasi</span>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <IconX className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
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
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center justify-start gap-2  group/sidebar py-2",
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
        className="min-w-0 truncate text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        {link.label}
      </motion.span>
    </Link>
  );
};

// Add LinkProps type if not present or just use any
type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement>;
