"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    LayoutDashboard,
    LogOut,
    Wallet,
    QrCode,
    BookOpen,
    Package,
    Users,
    Activity,
    FileText,
    TrendingUp,
    Moon,
    Sun,
    Laptop
} from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import { useAuthStore } from "@/lib/stores/auth-store";
import { signOut } from "next-auth/react";

export function CommandMenu() {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();
    const { setTheme } = useTheme();
    const { user } = useAuthStore();

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false);
        command();
    }, []);

    return (
        <>
            <p className="text-sm text-muted-foreground hidden lg:inline-flex items-center gap-2 border rounded-md px-3 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setOpen(true)}>
                <span>Cari menu...</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </p>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Ketik perintah atau cari..." />
                <CommandList>
                    <CommandEmpty>Tidak ada hasil ditemukan.</CommandEmpty>
                    
                    <CommandGroup heading="Utama">
                        <CommandItem onSelect={() => runCommand(() => router.push("/overview"))}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Dashboard</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/profile"))}>
                            <User className="mr-2 h-4 w-4" />
                            <span>Profil Saya</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandGroup heading="Akademik">
                        <CommandItem onSelect={() => runCommand(() => router.push("/pendaftar"))}>
                            <Users className="mr-2 h-4 w-4" />
                            <span>Pendaftaran Siswa</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/pengumuman"))}>
                            <FileText className="mr-2 h-4 w-4" />
                            <span>Pengumuman</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandGroup heading="Tabungan">
                        <CommandItem onSelect={() => runCommand(() => router.push("/tabungan"))}>
                            <Wallet className="mr-2 h-4 w-4" />
                            <span>Dashboard Tabungan</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/tabungan/scan"))}>
                            <QrCode className="mr-2 h-4 w-4" />
                            <span>Scan Transaksi</span>
                            <CommandShortcut>SCN</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/tabungan/verifikasi"))}>
                            <Activity className="mr-2 h-4 w-4" />
                            <span>Verifikasi Transaksi</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/tabungan/siswa"))}>
                            <Users className="mr-2 h-4 w-4" />
                            <span>Data Siswa Tabungan</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandGroup heading="Perpustakaan">
                        <CommandItem onSelect={() => runCommand(() => router.push("/perpus"))}>
                            <BookOpen className="mr-2 h-4 w-4" />
                            <span>Dashboard Pustaka</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/perpus/peminjaman"))}>
                            <FileText className="mr-2 h-4 w-4" />
                            <span>Peminjaman</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandGroup heading="Inventaris">
                        <CommandItem onSelect={() => runCommand(() => router.push("/inventaris"))}>
                            <Package className="mr-2 h-4 w-4" />
                            <span>Dashboard Inventaris</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push("/inventaris/aset"))}>
                            <TrendingUp className="mr-2 h-4 w-4" />
                            <span>Data Aset</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />
                    
                    <CommandGroup heading="Tema">
                        <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
                            <Sun className="mr-2 h-4 w-4" />
                            <span>Light Mode</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
                            <Moon className="mr-2 h-4 w-4" />
                            <span>Dark Mode</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setTheme("system"))}>
                            <Laptop className="mr-2 h-4 w-4" />
                            <span>System</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandGroup heading="Akun">
                        <CommandItem onSelect={() => runCommand(() => signOut({ callbackUrl: "/login" }))}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Log out</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}
