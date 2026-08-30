"use client";

import { motion } from "framer-motion";
import { HeroSection } from "./sections/hero";
import { BeritaSection } from "./sections/berita-section";
import { LayananSection } from "./sections/layanan-section";
import { SPMBSection } from "./sections/spmb-section";
import { KontakSection } from "./sections/kontak-section";
import { useLanding } from "./use-landing";
import { Loader2 } from "lucide-react";

export default function PublicLandingPage() {
  const landing = useLanding();

  if (!landing.mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative w-full bg-zinc-950 text-white overflow-x-hidden"
    >
      <div id="hero">
        <HeroSection
          schoolTagline={landing.schoolTagline}
          schoolDescription={landing.schoolDescription}
          handleScrollTo={landing.handleScrollTo}
        />
      </div>

      <div id="berita">
        <BeritaSection
          landingTexts={landing.landingTexts}
          news={landing.news}
          newsSearch={landing.newsSearch}
          setNewsSearch={landing.setNewsSearch}
          newsFilter={landing.newsFilter}
          setNewsFilter={landing.setNewsFilter}
          filteredNews={landing.filteredNews}
          selectedNews={landing.selectedNews}
          setSelectedNews={landing.setSelectedNews}
        />
      </div>

      <div id="layanan">
        <LayananSection
          landingTexts={landing.landingTexts}
          landingSections={landing.landingSections}
        />
      </div>

      <div id="spmb">
        <SPMBSection
          landingTexts={landing.landingTexts}
          landingSections={landing.landingSections}
          handleScrollTo={landing.handleScrollTo}
        />
      </div>

      <div id="kontak">
        <KontakSection
          landingTexts={landing.landingTexts}
          landingSections={landing.landingSections}
          contactSettings={landing.contactSettings}
          settings={landing.settings}
          filteredFaqs={landing.filteredFaqs}
          faqSearch={landing.faqSearch}
          setFaqSearch={landing.setFaqSearch}
        />
      </div>
    </motion.div>
  );
}