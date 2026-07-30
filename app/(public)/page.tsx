"use client";

import React from "react";
import { useLanding, navItems } from "./use-landing";
import { HeroSection } from "./sections/hero";
import { ProfilSection } from "./sections/profil-section";
import { BeritaSection } from "./sections/berita-section";
import { GaleriSection } from "./sections/galeri-section";
import { KeunggulanSection } from "./sections/keunggulan-section";
import { LayananSection } from "./sections/layanan-section";
import { SPMBSection } from "./sections/spmb-section";
import { KontakSection } from "./sections/kontak-section";

export default function HomePage() {
  const ctx = useLanding();
  if (!ctx.mounted) return null;

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-50 overflow-hidden font-sans selection:bg-blue-500 selection:text-white">
      <HeroSection
        schoolName={ctx.settings?.school_name}
        schoolTagline={ctx.schoolTagline}
        schoolDescription={ctx.schoolDescription}
        handleScrollTo={ctx.handleScrollTo}
      />

      <div className="relative z-20 w-full flex flex-col min-h-screen">
        <ProfilSection landingTexts={ctx.landingTexts} schoolVisi={ctx.schoolVisi} schoolMisi={ctx.schoolMisi} />

        <BeritaSection
          landingTexts={ctx.landingTexts}
          news={ctx.news}
          newsSearch={ctx.newsSearch}
          setNewsSearch={ctx.setNewsSearch}
          newsFilter={ctx.newsFilter}
          setNewsFilter={ctx.setNewsFilter}
          filteredNews={ctx.filteredNews}
          selectedNews={ctx.selectedNews}
          setSelectedNews={ctx.setSelectedNews}
        />

        <GaleriSection
          landingTexts={ctx.landingTexts}
          galleryItems={ctx.galleryItems}
          isGalleryLoading={ctx.isGalleryLoading}
          selectedImage={ctx.selectedImage}
          setSelectedImage={ctx.setSelectedImage}
        />

        <KeunggulanSection landingTexts={ctx.landingTexts} landingSections={ctx.landingSections} />

        <LayananSection landingTexts={ctx.landingTexts} landingSections={ctx.landingSections} />

        <SPMBSection landingTexts={ctx.landingTexts} landingSections={ctx.landingSections} handleScrollTo={ctx.handleScrollTo} />

        <KontakSection
          landingTexts={ctx.landingTexts}
          landingSections={ctx.landingSections}
          contactSettings={ctx.contactSettings}
          settings={ctx.settings}
          filteredFaqs={ctx.filteredFaqs}
          faqSearch={ctx.faqSearch}
          setFaqSearch={ctx.setFaqSearch}
        />
      </div>
    </div>
  );
}