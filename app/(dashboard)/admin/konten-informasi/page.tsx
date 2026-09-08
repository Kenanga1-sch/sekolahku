"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Newspaper, Camera, BarChart3 } from "lucide-react";

import { useMessages } from "./use-messages";
import { useAnnouncements } from "./use-announcements";
import { useGallery } from "./use-gallery";
import { MessagesTab } from "./messages-tab";
import { AnnouncementsTab } from "./announcements-tab";
import { GalleryTab } from "./gallery-tab";

type TabKey = "pesan" | "pengumuman" | "galeri";

const tabs: { id: TabKey; label: string; icon: React.ReactNode }[] = [
  { id: "pesan", label: "Pesan Masuk", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "pengumuman", label: "Pengumuman & Berita", icon: <Newspaper className="h-4 w-4" /> },
  { id: "galeri", label: "Galeri Foto", icon: <Camera className="h-4 w-4" /> },
];

export default function KontenInformasiPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("pesan");
  const messages = useMessages();
  const announcements = useAnnouncements(activeTab === "pengumuman");
  const gallery = useGallery(activeTab === "galeri");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Konten & Informasi</h1>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-zinc-300 dark:hover:border-zinc-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "pesan" && <MessagesTab {...messages} />}
      {activeTab === "pengumuman" && <AnnouncementsTab {...announcements} />}
      {activeTab === "galeri" && <GalleryTab {...gallery} />}
    </div>
  );
}