"use client";

import { useEffect, useState } from "react";
import { Check, Palette, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const themes = [
    {
        name: "Royal Blue",
        color: "oklch(0.45 0.22 265)",
        activeColor: "265",
    },
    {
        name: "Emerald",
        color: "oklch(0.5 0.21 145)",
        activeColor: "145",
    },
    {
        name: "Violet",
        color: "oklch(0.5 0.23 290)",
        activeColor: "290",
    },
    {
        name: "Rose",
        color: "oklch(0.5 0.2 10)",
        activeColor: "10",
    },
    {
        name: "Amber",
        color: "oklch(0.6 0.18 50)",
        activeColor: "50",
    },
    {
        name: "Cyan",
        color: "oklch(0.5 0.18 200)",
        activeColor: "200",
    },
];

export function ThemeCustomizer() {
    const [mounted, setMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [activeTheme, setActiveTheme] = useState("Royal Blue");

    useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem("theme-color");
        if (savedTheme) {
            applyTheme(savedTheme);
            setActiveTheme(savedTheme);
        }
    }, []);

    const applyTheme = (themeName: string) => {
        const theme = themes.find((t) => t.name === themeName);
        if (!theme) return;

        const root = document.documentElement;
        
        // We only change the Hue and Chroma for primary/ring
        // But since we use OKLCH, we can just replace the whole value or specific components.
        // For simplicity, let's inject the specific color variables.
        
        // This is a simplified approach assuming the globals.css uses these variables cleanly.
        // Note: Tailwind v4 might handle this differently, but setting var on :root usually works.
        
        root.style.setProperty("--primary", theme.color);
        // Also update ring to match
        root.style.setProperty("--ring", theme.color.replace(")", " / 0.5)"));
        // And sidebar primary
        root.style.setProperty("--sidebar-primary", theme.color);
        
        localStorage.setItem("theme-color", themeName);
        setActiveTheme(themeName);
    };

    const resetTheme = () => {
        applyTheme("Royal Blue");
        localStorage.removeItem("theme-color");
    };

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="rounded-full">
                <Palette className="h-5 w-5 opacity-50" />
            </Button>
        );
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full" size="icon">
                    <Palette className="h-5 w-5" />
                    <span className="sr-only">Kustomisasi Tema</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="flex items-center justify-between pb-4 border-b">
                    <div className="space-y-1">
                        <h4 className="font-semibold leading-none">Warna Tema</h4>
                        <p className="text-sm text-muted-foreground">
                            Pilih warna aksen aplikasi.
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetTheme}>
                        <RotateCcw className="h-4 w-4" />
                        <span className="sr-only">Reset</span>
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 py-4">
                    {themes.map((theme) => (
                        <Button
                            key={theme.name}
                            variant="outline"
                            className={cn(
                                "justify-start gap-2 h-10 px-3",
                                activeTheme === theme.name && "border-primary bg-accent text-accent-foreground"
                            )}
                            onClick={() => applyTheme(theme.name)}
                        >
                            <span
                                className="h-4 w-4 rounded-full flex items-center justify-center shrink-0"
                                style={{ backgroundColor: theme.color }}
                            >
                                {activeTheme === theme.name && (
                                    <Check className="h-3 w-3 text-white stroke-[3px]" />
                                )}
                            </span>
                            <span className="text-xs font-medium">{theme.name}</span>
                        </Button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
