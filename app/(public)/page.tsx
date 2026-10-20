"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowRightLeft,
  BookOpen,
  Calendar,
  MapPin,
  MessageSquareHeart,
  Newspaper,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { goGet } from "@/lib/api-client";
import { formatNamaGtk } from "@/lib/gtk-name";
import { getSchoolLogo } from "@/lib/school-logo";
import { useAuthStore } from "@/lib/stores/auth-store";
import { siteConfig } from "@/lib/config";
import { Reveal } from "@/components/public/motion";
import { HeroShader } from "@/components/public/hero-shader";
import { SectionHeader } from "@/components/layout/page-header";

interface HomepageData {
  settings?: {
    school_name?: string;
    school_logo?: string;
    school_address?: string;
    current_academic_year?: string;
    spmb_is_open?: boolean;
    landing_description?: string;
    landing_texts?: string;
  };
  news?: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    category?: string | null;
    thumbnail?: string | null;
    published_at?: string | null;
  }>;
  activePeriod?: {
    name?: string;
    academic_year?: string;
    quota?: number;
  } | null;
  stats?: {
    studentCount?: number;
  };
}

interface StaffItem {
  id: string;
  name: string;
  degree?: string | null;
  position?: string;
  photoUrl?: string;
  category?: string;
}

interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  category?: string;
}

const services = [
  {
    title: "Perpustakaan",
    description: "Jelajahi koleksi buku dan cek ketersediaan secara real-time.",
    href: "/katalog-buku",
    icon: BookOpen,
  },
  {
    title: "Mutasi",
    description: "Ajukan pindah masuk dan pantau status permohonan.",
    href: "/layanan/mutasi",
    icon: ArrowRightLeft,
  },
  {
    title: "Kritik & Pengaduan",
    description: "Sampaikan masukan atau laporan secara anonim dan aman.",
    href: "/layanan/kritik-saran-pengaduan",
    icon: MessageSquareHeart,
  },
];

export default function PublicHomepage() {
  const { isAuthenticated, user } = useAuthStore();
  const [data, setData] = useState<HomepageData | null>(null);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  const dashboardHref =
    user?.role === "staff" ? "/inventaris" : user?.role === "orangtua" ? "/parent" : "/overview";

  useEffect(() => {
    goGet("/api/public/homepage", { ttl: 60_000 })
      .then((json: HomepageData) => setData(json))
      .catch(() => setData(null));

    goGet("/api/public/staff?perPage=8", { ttl: 300_000 })
      .then((json: { data?: StaffItem[] }) =>
        setStaff(Array.isArray(json?.data) ? json.data : [])
      )
      .catch(() => setStaff([]));

    goGet("/api/public/gallery?perPage=6", { ttl: 120_000 })
      .then((json: { data?: GalleryItem[] }) =>
        setGallery(Array.isArray(json?.data) ? json.data : [])
      )
      .catch(() => setGallery([]));
  }, []);

  const schoolName = data?.settings?.school_name || siteConfig.school.name;
  const schoolAddress = data?.settings?.school_address || siteConfig.school.address;
  const schoolLogo = getSchoolLogo(data?.settings?.school_logo);
  const academicYear =
    data?.settings?.current_academic_year ||
    data?.activePeriod?.academic_year ||
    siteConfig.academicYear.current;
  const spmbOpen = data?.settings?.spmb_is_open || !!data?.activePeriod;
  const studentCount = data?.stats?.studentCount ?? 0;
  const news = (data?.news ?? []).slice(0, 4);
  const heroImage =
    gallery[0] ??
    (news[0]?.thumbnail
      ? { imageUrl: news[0].thumbnail, title: news[0].title }
      : undefined);

  let heroTexts: Record<string, string> = {};
  try {
    const parsed = data?.settings?.landing_texts ? JSON.parse(data.settings.landing_texts) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) heroTexts = parsed;
  } catch {
    heroTexts = {};
  }

  const heroBadge = heroTexts.hero_badge
    ? heroTexts.hero_badge.replace("{year}", academicYear)
    : `Tahun Ajaran ${academicYear}`;
  const heroCtaLabel = heroTexts.cta_primary_label || (spmbOpen ? "Daftar Sekarang" : "Info Pendaftaran");

  const stats = [
    {
      label: "Siswa aktif",
      value: studentCount > 0 ? studentCount.toLocaleString("id-ID") : "—",
    },
    {
      label: "Guru & staf",
      value: staff.length > 0 ? `${staff.length}+` : "—",
    },
    { label: "Tahun ajaran", value: academicYear },
    { label: "Program", value: "SPMB" },
  ];

  return (
    <div className="flex flex-col bg-public-bg">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-line/60">
        <HeroShader />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-public-bg via-public-bg/85 to-public-bg/20" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-14 md:grid-cols-[1.02fr_0.98fr] md:pb-24 md:pt-20">
          <div className="max-w-2xl">
            <Reveal>
              <Badge
                variant="outline"
                className="border-line/80 bg-surface/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary backdrop-blur-sm"
              >
                {heroBadge}
              </Badge>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="mt-5 text-balance font-serif text-[2.65rem] font-semibold leading-[1.04] tracking-tight text-foreground sm:text-5xl lg:text-[3.65rem]">
                {schoolName}
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-5 max-w-[54ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
                {data?.settings?.landing_description ||
                  "Membangun generasi cerdas dan berkarakter melalui pendidikan berkualitas yang terintegrasi teknologi."}
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-11 px-6">
                  <Link href="/spmb">
                    {heroCtaLabel}
                    <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-11 px-6">
                  <Link href="/layanan">Layanan Sekolah</Link>
                </Button>
                {isAuthenticated && (
                  <Button asChild size="lg" variant="ghost" className="h-11 px-5">
                    <Link href={dashboardHref}>Buka dashboard</Link>
                  </Button>
                )}
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {schoolAddress && (
                  <span className="inline-flex max-w-full items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="truncate">{schoolAddress}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Tahun ajaran {academicYear}
                </span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12}>
            <div className="relative mx-auto aspect-[4/3] w-full max-w-lg overflow-hidden rounded-3xl border border-white/60 bg-secondary/30 shadow-[0_24px_60px_-30px_rgba(4,34,43,0.45)] md:max-w-none">
              {heroImage ? (
                <Image
                  src={heroImage.imageUrl}
                  alt={heroImage.title || `Kegiatan ${schoolName}`}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 48vw"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-primary">
                  <div className="pattern-dots absolute inset-0 opacity-20" />
                  <div className="pattern-contour absolute inset-0 opacity-30" />
                  <div className="relative flex h-full flex-col items-center justify-center px-8 pb-20 text-center text-primary-foreground">
                    <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10 p-3">
                      <Image
                        src={schoolLogo}
                        alt={`Logo ${schoolName}`}
                        width={64}
                        height={64}
                        className="h-full w-full object-contain"
                      />
                    </span>
                    <p className="mt-6 max-w-xs text-balance font-serif text-2xl font-medium leading-snug">
                      Belajar dengan tenang, tumbuh dengan percaya diri.
                    </p>
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground-soft">
                      Sekolah dasar negeri
                    </p>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-primary/45 via-transparent to-transparent" />
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-surface/90 px-4 py-3 backdrop-blur-md">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-soft">
                    Tahun ajaran
                  </p>
                  <p className="text-sm font-semibold text-foreground">{academicYear}</p>
                </div>
                <Badge variant={spmbOpen ? "default" : "secondary"} className="shrink-0">
                  {spmbOpen ? "SPMB dibuka" : "Informasi sekolah"}
                </Badge>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Ringkasan sekolah ── */}
      <section className="relative z-10 -mt-8 pb-2">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line/60 bg-line/60 shadow-sm sm:grid-cols-4">
            {stats.map((item) => (
              <div key={item.label} className="bg-card px-4 py-4 text-center sm:px-5">
                <p className="text-xl font-bold tabular-nums text-primary sm:text-2xl">{item.value}</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-text-soft">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Layanan ── */}
      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <SectionHeader
              title="Layanan sekolah"
              description="Akses cepat ke layanan digital untuk siswa, orang tua, dan guru."
            />
          </Reveal>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {services.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.05}>
                <Link
                  href={item.href}
                  className="group flex h-full flex-col rounded-2xl border border-line/70 bg-card p-5 shadow-[0_1px_2px_rgba(4,34,43,0.04)] transition-colors hover:border-primary/30 hover:bg-surface-muted/30"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <item.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 flex items-center justify-between gap-2 text-base font-semibold text-foreground">
                    {item.title}
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SPMB ── */}
      {spmbOpen && (
        <section className="py-4 md:py-8">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-10 text-primary-foreground md:px-10 md:py-12">
                <div className="pattern-dots pointer-events-none absolute inset-0 opacity-20" />
                <div className="pattern-contour pointer-events-none absolute inset-0 opacity-30" />
                <div className="relative grid gap-8 md:grid-cols-[1.15fr_0.85fr] md:items-center">
                  <div>
                    <Badge className="border-0 bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                      Pendaftaran dibuka
                    </Badge>
                    <h2 className="mt-4 text-balance text-2xl font-bold leading-tight md:text-3xl">
                      {data?.activePeriod?.name || "Penerimaan Siswa Baru"}
                    </h2>
                    <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-primary-foreground-soft">
                      Segera daftarkan putra-putri Anda untuk tahun ajaran{" "}
                      {data?.activePeriod?.academic_year || academicYear}. Kuota terbatas dan
                      proses pendaftaran dilakukan secara bertahap.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button asChild variant="secondary" size="lg" className="h-11 px-6">
                        <Link href="/spmb">
                          Cara mendaftar <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Kuota", value: data?.activePeriod?.quota ?? "—" },
                      { label: "Tahun ajaran", value: data?.activePeriod?.academic_year || academicYear },
                      { label: "Jalur", value: "Domisili" },
                      { label: "Status", value: "Dibuka" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-white/15 bg-white/10 p-4"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground-soft">
                          {item.label}
                        </p>
                        <p className="mt-1.5 text-xl font-bold">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── Berita ── */}
      {news.length > 0 && (
        <section className="py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal>
              <SectionHeader
                title="Berita terbaru"
                description="Informasi dan pengumuman terkini dari sekolah."
                action={
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/berita">
                      Lihat semua <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                }
              />
            </Reveal>

            <div className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
              <Reveal>
                <Link
                  href={`/berita/detail?slug=${encodeURIComponent(news[0].slug)}`}
                  className="group relative flex h-full min-h-[320px] flex-col justify-end overflow-hidden rounded-2xl border border-line/70 bg-primary p-5 text-primary-foreground"
                >
                  {news[0].thumbnail ? (
                    <Image
                      src={news[0].thumbnail}
                      alt={news[0].title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 55vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="hero-shader-poster absolute inset-0" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/35 to-transparent" />
                  <div className="relative">
                    {news[0].category && (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground-soft">
                        {news[0].category}
                      </span>
                    )}
                    <h3 className="mt-2 max-w-xl text-balance text-xl font-semibold leading-snug md:text-2xl">
                      {news[0].title}
                    </h3>
                    {news[0].excerpt && (
                      <p className="mt-2 line-clamp-2 max-w-lg text-sm leading-relaxed text-primary-foreground-soft">
                        {news[0].excerpt}
                      </p>
                    )}
                  </div>
                </Link>
              </Reveal>

              {news.length > 1 && (
                <div className="grid gap-3">
                  {news.slice(1).map((item, index) => (
                    <Reveal key={item.id} delay={index * 0.05}>
                      <Link
                        href={`/berita/detail?slug=${encodeURIComponent(item.slug)}`}
                        className="group flex gap-4 rounded-2xl border border-line/70 bg-card p-3 transition-colors hover:border-primary/30 hover:bg-surface-muted/30"
                      >
                        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary/30">
                          {item.thumbnail ? (
                            <Image
                              src={item.thumbnail}
                              alt={item.title}
                              fill
                              sizes="96px"
                              className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Newspaper className="h-6 w-6 text-primary/40" aria-hidden="true" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 py-0.5">
                          {item.category && (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                              {item.category}
                            </span>
                          )}
                          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                            {item.title}
                          </h3>
                          {item.excerpt && (
                            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                              {item.excerpt}
                            </p>
                          )}
                        </div>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Galeri ── */}
      {gallery.length > 0 && (
        <section className="bg-surface py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal>
              <SectionHeader
                title="Galeri kegiatan"
                description="Momen belajar dan berkarya di lingkungan sekolah."
              />
            </Reveal>

            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
              {gallery.map((item, index) => (
                <Reveal key={item.id} delay={index * 0.04}>
                  <div
                    className={`group relative overflow-hidden rounded-2xl bg-secondary/20 ${
                      index === 0
                        ? "col-span-2 row-span-2 aspect-[4/3] md:aspect-auto md:h-full"
                        : "aspect-[4/3]"
                    }`}
                  >
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      sizes={
                        index === 0
                          ? "(max-width: 768px) 100vw, 50vw"
                          : "(max-width: 768px) 50vw, 25vw"
                      }
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-transparent opacity-80" />
                    <p className="absolute inset-x-3 bottom-3 line-clamp-2 text-xs font-medium text-white">
                      {item.title}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Guru & staf ── */}
      {staff.length > 0 && (
        <section className="py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal>
              <SectionHeader
                title="Guru & tenaga kependidikan"
                description="Tim pendidik yang mendampingi siswa setiap hari."
              />
            </Reveal>

            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {staff.map((person, index) => (
                <Reveal key={person.id} delay={index * 0.04}>
                  <div className="group">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line/70 bg-secondary/30">
                      {person.photoUrl ? (
                        <Image
                          src={person.photoUrl}
                          alt={person.name}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-primary">
                          <Users className="h-10 w-10" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <h3 className="mt-3 line-clamp-1 text-sm font-semibold text-foreground">
                      {formatNamaGtk(person.name, person.degree)}
                    </h3>
                    {person.position && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {person.position}
                      </p>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA akhir ── */}
      <section className="pb-16 md:pb-24">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-10 text-primary-foreground md:px-10 md:py-12">
              <div className="pattern-dots pointer-events-none absolute inset-0 opacity-20" />
              <div className="pattern-contour pointer-events-none absolute inset-0 opacity-30" />
              <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground-soft">
                    Bergabung bersama kami
                  </p>
                  <h2 className="mt-2 text-balance text-2xl font-bold leading-tight md:text-3xl">
                    Siap menjadi bagian dari {schoolName}?
                  </h2>
                  <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-primary-foreground-soft">
                    Mulai langkah pendaftaran atau hubungi sekolah untuk informasi lebih lanjut.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3">
                  <Button asChild variant="secondary" size="lg" className="h-11 px-6">
                    <Link href="/spmb">
                      Mulai pendaftaran <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-11 border-white/30 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white">
                    <Link href="/layanan">Lihat layanan</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
