import { getHomepageData } from "@/lib/data/homepage";
import { HomeClient } from "@/components/landing/home-client";

export const metadata = {
  title: "Beranda | Sekolahku",
  description: "Selamat datang di website resmi Sekolahku. Pusat informasi dan layanan akademik terpadu.",
};

export const revalidate = 60; // Revalidate data every 60 seconds (ISR)

export default async function HomePage() {
  const data = await getHomepageData();

  return (
    <HomeClient
      settings={data.settings}
      news={data.news || []}
      activePeriod={data.activePeriod}
      studentCount={data.stats.studentCount || 0}
    />
  );
}
