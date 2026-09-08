"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Users, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { goGet } from "@/lib/api-client";
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
    <div className="flex flex-col bg-[#FFF8E7] min-h-[70dvh]">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-4 rounded-2xl bg-white border border-[#d1e7dd] animate-pulse">
                  <div className="h-20 w-20 rounded-full bg-[#A7F3D0]/40 mx-auto mb-3" />
                  <div className="h-4 w-3/4 bg-[#A7F3D0]/40 rounded mx-auto" />
                  <div className="h-3 w-1/2 bg-[#A7F3D0]/30 rounded mx-auto mt-2" />
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-12 rounded-2xl bg-white border border-dashed border-[#d1e7dd] text-center">
              <Users className="h-10 w-10 text-[#065F46]/30 mx-auto mb-4" />
              <p className="text-[#4b6b4b]">Data guru dan staf akan segera tersedia.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
              {sorted.map((person, i) => (
                <Reveal key={person.id} delay={Math.min(i * 0.04, 0.4)}>
                  <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-white border border-[#d1e7dd] hover:border-[#065F46]/20 hover:shadow-md transition-all h-full">
                    <div className="h-20 w-20 rounded-full overflow-hidden bg-[#A7F3D0]/50 mb-4 ring-2 ring-[#A7F3D0] ring-offset-2 ring-offset-white">
                      {person.photoUrl ? (
                        <Image src={person.photoUrl} alt={person.name} width={80} height={80} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[#065F46]/50">
                          <Users className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <h2 className="text-sm font-semibold text-[#1a2e1a] leading-snug">
                      {person.name}
                      {person.degree && <span className="text-[#4b6b4b] font-normal">, {person.degree}</span>}
                    </h2>
                    {person.position && (
                      <p className="text-xs text-[#4b6b4b] mt-1">{person.position}</p>
                    )}
                    {person.category && (
                      <Badge className="mt-2 bg-[#A7F3D0]/50 text-[#065F46] border-0 text-[10px] font-medium">
                        {categoryLabel(person.category)}
                      </Badge>
                    )}
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
