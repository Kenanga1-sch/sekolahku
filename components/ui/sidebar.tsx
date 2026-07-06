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
  }, [pathname, setOpen]);

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
    <>
      <motion.div
        className={cn(
          "h-14 px-3 py-3 flex flex-row md:hidden items-center justify-start fixed top-0 left-0 z-[100] w-auto pointer-events-none"
        )}
        {...props}
      >
        <div className="flex justify-start z-50 w-auto pointer-events-auto pl-1">
          <IconMenu2
            className="h-6 w-6 text-neutral-800 dark:text-neutral-200 cursor-pointer pointer-events-auto"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed inset-0 h-dvh w-full bg-white dark:bg-neutral-900 p-5 pt-14 sm:p-8 z-[100] flex flex-col justify-between pointer-events-auto overflow-y-auto",
                className
              )}
            >
              <div
                className="absolute right-5 top-5 sm:right-8 sm:top-8 z-50 text-neutral-800 dark:text-neutral-200"
                onClick={() => setOpen(!open)}
              >
                <IconX className="h-6 w-6" />
              </div>
              {children as any}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
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
