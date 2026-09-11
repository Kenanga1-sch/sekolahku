"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Users, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { goGet } from "@/lib/api-client";
import { normalizePublicPath } from "@/lib/utils";
import { Reveal } from "@/components/public/motion";

interface StaffItem {
  id: string;
  name: string;
  category?: string;
  degree?: string;
  position?: string;
  photoUrl?: string;
  quote?: string;
}

export default function GuruStafPage() {
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    goGet("/api/public/staff?perPage=100", { ttl: 300_000 })
      .then((json: { data?: StaffItem[] }) => setStaff(Array.isArray(json?.data) ? json.data : []))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  }, []);

  const categoryLabel = (cat?: string) => {
    switch (cat) {
      case "kepsek": return "Kepala Sekolah";
      case "guru": return "Guru";
      case "staff": return "Staf";
      case "support": return "Tenaga Pendukung";
      default: return cat || "";
    }
  };

  const sorted = [...staff].sort((a, b) => {
    const order = { kepsek: 0, guru: 1, staff: 2, support: 3 } as Record<string, number>;
    return (order[a.category ?? "z"] ?? 9) - (order[b.category ?? "z"] ?? 9);
  });

  return (
    <div className="flex flex-col bg-public-bg min-h-[70dvh]">
      <section className="py-12 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal>
            <h1 className="text-3xl md:text-4xl font-bold text-[#1a2e1a] mb-3">Guru &amp; Tenaga Kependidikan</h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[#4b6b4b] mb-10 max-w-[55ch]">
              Tim pendidik dan tenaga kependidikan yang mendedikasikan diri untuk pendidikan siswa kami.
            </p>
          </Reveal>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white border border-public-border shadow-sm overflow-hidden animate-pulse">
                  <div className="aspect-[4/5] bg-[#A7F3D0]/40" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 w-3/4 bg-[#A7F3D0]/40 rounded mx-auto" />
                    <div className="h-3 w-1/2 bg-[#A7F3D0]/30 rounded mx-auto" />
                    <div className="h-10 w-full bg-[#A7F3D0]/20 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-12 rounded-2xl bg-white border border-dashed border-public-border text-center">
              <Users className="h-10 w-10 text-[#065F46]/30 mx-auto mb-4" />
              <p className="text-[#4b6b4b]">Data guru dan staf akan segera tersedia.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {sorted.map((person, i) => (
                <Reveal key={person.id} delay={Math.min(i * 0.04, 0.4)}>
                  <div className="group flex flex-col rounded-2xl bg-white border border-public-border shadow-sm hover:border-[#065F46]/20 hover:shadow-md transition-all h-full overflow-hidden">
                    {/* Foto 4:5 full-width — elemen dominan kartu */}
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#A7F3D0]/50">
                      {person.photoUrl ? (
                        <Image
                          src={normalizePublicPath(person.photoUrl)}
                          alt={`Foto ${person.name}`}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[#065F46]/40">
                          <Users className="h-16 w-16" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col items-center text-center p-5 gap-1.5">
                      {person.category && (
                        <Badge className="bg-[#A7F3D0]/50 text-[#065F46] border-0 text-[10px] font-medium order-first">
                          {categoryLabel(person.category)}
                        </Badge>
                      )}
                      <h2 className="text-base font-semibold text-[#1a2e1a] leading-snug">
                        {person.name}
                        {person.degree && <span className="text-[#4b6b4b] font-normal">, {person.degree}</span>}
                      </h2>
                      {person.position && (
                        <p className="text-xs text-[#4b6b4b]">{person.position}</p>
                      )}
                      {person.quote && (
                        <blockquote className="mt-3 flex flex-col items-center gap-1.5 pt-3 border-t border-public-border/60 w-full">
                          <Quote className="h-3.5 w-3.5 text-[#065F46]/40 shrink-0" />
                          <p className="italic text-[13px] leading-relaxed text-[#4b6b4b] line-clamp-4">
                            {person.quote}
                          </p>
                        </blockquote>
                      )}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
