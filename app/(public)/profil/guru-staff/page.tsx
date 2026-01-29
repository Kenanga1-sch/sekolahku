"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, Quote } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PublicStaffPage() {
  const { data, isLoading } = useSWR("/api/admin/staff", fetcher);
  const { settings } = useSchoolSettings();
  const [filter, setFilter] = useState<"all" | "guru" | "staff" | "support">("all");

  const allStaff = data?.data || [];
  
  // Filter active only
  const activeStaff = allStaff.filter((s: any) => s.isActive);

  // Separate Kepsek
  const kepsek = activeStaff.find((s: any) => s.category === "kepsek");
  
  // Others
  const others = activeStaff
    .filter((s: any) => s.category !== "kepsek")
    .filter((s: any) => filter === "all" || s.category === filter);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-12 space-y-12">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Pendidik & Tenaga Kependidikan
        </h1>
        <p className="text-muted-foreground text-lg">
          Mengenal lebih dekat sosok-sosok inspiratif yang berdedikasi mendidik dan melayani di sekolah kami.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap justify-center gap-2">
        {[
            { id: "all", label: "Semua" },
            { id: "guru", label: "Guru" },
            { id: "staff", label: "Staff & TU" },
            { id: "support", label: "Support" },
        ].map((item) => (
            <Button
                key={item.id}
                variant={filter === item.id ? "default" : "outline"}
                onClick={() => setFilter(item.id as any)}
                className="rounded-full"
            >
                {item.label}
            </Button>
        ))}
      </div>

      {/* Featured Kepsek */}
      {kepsek && filter === "all" && (
        <div className="flex justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800"
          >
            <div className="aspect-[4/5] relative">
                <Image 
                    src={kepsek.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${kepsek.name}`}
                    alt={kepsek.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <Badge className="mb-2 bg-blue-600 hover:bg-blue-600">Kepala Sekolah</Badge>
                    <h2 className="text-2xl font-bold mb-1">
                        {kepsek.name}{kepsek.degree ? `, ${kepsek.degree}` : ""}
                    </h2>
                    <p className="opacity-90">{kepsek.position}</p>
                    {kepsek.quote && (
                        <div className="mt-4 pt-4 border-t border-white/20 flex gap-2">
                             <Quote className="h-4 w-4 text-blue-400 shrink-0" />
                             <p className="text-sm italic opacity-80">"{kepsek.quote}"</p>
                        </div>
                    )}
                </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
            {others.map((staff: any) => (
                <motion.div
                    key={staff.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                >
                    <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow border-zinc-200 dark:border-zinc-800 group flex flex-col">
                        <div className="aspect-[3/4] relative bg-zinc-100 dark:bg-zinc-800 transition-all">
                             <Image 
                                src={staff.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${staff.name}`}
                                alt={staff.name}
                                fill
                                className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                        <CardHeader className="p-4 space-y-1">
                            <h3 className="font-semibold leading-tight line-clamp-2">
                                {staff.name}{staff.degree ? `, ${staff.degree}` : ""}
                            </h3>
                            <p className="text-sm text-muted-foreground">{staff.position}</p>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            {staff.quote ? (
                                <p className="text-xs text-muted-foreground italic">
                                    "{staff.quote}"
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground/50 italic">
                                    ~ {settings?.school_name || "Sekolah"} ~
                                </p> 
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            ))}
        </AnimatePresence>
      </div>

      {others.length === 0 && !kepsek && (
        <div className="text-center py-20 text-muted-foreground">
            Belum ada data staff untuk kategori ini.
        </div>
      )}
    </div>
  );
}
