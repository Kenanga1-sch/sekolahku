"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import {
  Users, UserCheck, UserX, Clock, TrendingUp, Calendar, ArrowRight,
  BookOpen, Package, Wallet, AlertTriangle, CheckCircle2, ArrowUpRight,
  DollarSign, BookMarked, Boxes, Bell, Activity, Info
} from "lucide-react";
import { TeacherRoadmap } from "@/components/dashboard/teacher/teacher-roadmap";
import { QuickAccessCards } from "@/components/dashboard/teacher/quick-access-cards";
import { TeacherAssistantPanel } from "@/components/dashboard/teacher/teacher-assistant-panel";
import { formatCurrency } from "@/lib/utils";
import { SPMBStatusBadge } from "@/components/spmb/status-badge";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { CardContainer, CardBody, CardItem } from "@/components/ui/3d-card";

// Lazy load heavy chart components
const RegistrationTrendChart = dynamic(
  () => import("@/components/dashboard/charts").then(mod => ({ default: mod.RegistrationTrendChart })),
  {
    loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[250px] w-full" /></CardContent></Card>,
    ssr: false
  }
);

const StatusDistributionChart = dynamic(
  () => import("@/components/dashboard/charts").then(mod => ({ default: mod.StatusDistributionChart })),
  {
    loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[250px] w-full" /></CardContent></Card>,
    ssr: false
  }
);

interface OverviewClientProps {
  stats: any;
  moduleStats: any;
  teacherStats: any;
  recentRegistrants: any[];
  activePeriod: any;
  serverHealth: any;
}

export function OverviewClient({ 
  stats, 
  moduleStats, 
  teacherStats, 
  recentRegistrants, 
  activePeriod,
  serverHealth 
}: OverviewClientProps) {
  
  // Prepare Chart Data
  const statusData = [
    { name: "Pending", value: stats.pending, color: "#f59e0b" },
    { name: "Terverifikasi", value: stats.verified, color: "#3b82f6" },
    { name: "Diterima", value: stats.accepted, color: "#22c55e" },
    { name: "Ditolak", value: stats.rejected, color: "#ef4444" },
  ].filter(item => item.value > 0);

  // Generate trend data
  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split("T")[0];
  });
  
  const trendData = last7Days.map(dateStr => {
    const count = recentRegistrants.filter((r: any) => r.created?.startsWith(dateStr)).length;
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      count
    };
  });

  // Generate activities
  const recentActivities = [];
  if (moduleStats.perpustakaan.activeLoans > 0) {
    recentActivities.push({
      id: '1', type: 'library', title: 'Peminjaman Buku Aktif',
      description: `${moduleStats.perpustakaan.activeLoans} buku sedang dipinjam`,
      time: 'Hari ini', icon: BookOpen, color: 'text-blue-500'
    });
  }
  if (moduleStats.inventaris.needsMaintenance > 0) {
    recentActivities.push({
      id: '2', type: 'inventory', title: 'Aset Perlu Perbaikan',
      description: `${moduleStats.inventaris.needsMaintenance} aset butuh perhatian`,
      time: 'Perlu tindakan', icon: AlertTriangle, color: 'text-amber-500'
    });
  }
  if (moduleStats.tabungan.todayTransactions > 0) {
    recentActivities.push({
      id: '3', type: 'savings', title: 'Transaksi Hari Ini',
      description: `${moduleStats.tabungan.todayTransactions} transaksi tabungan`,
      time: 'Hari ini', icon: Wallet, color: 'text-emerald-500'
    });
  }
  if (stats.pending > 0) {
    recentActivities.push({
      id: '4', type: 'spmb', title: 'Pendaftar Baru',
      description: `${stats.pending} menunggu verifikasi`,
      time: 'Perlu tindakan', icon: Users, color: 'text-purple-500'
    });
  }

  // Cards Config
  const spmbCards = [
    {
      title: "Total Pendaftar", 
      value: stats.total.toString(), 
      description: "Total keseluruhan pendaftar masuk",
      icon: <Users className="h-4 w-4 text-neutral-500" />,
      header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-neutral-200 dark:from-neutral-900 dark:to-neutral-800 to-neutral-100 items-center justify-center text-4xl font-bold text-neutral-700 dark:text-neutral-200">{stats.total}</div>,
      className: "md:col-span-2", 
    },
    {
      title: "Menunggu Verifikasi", 
      value: stats.pending.toString(), 
      description: "Memerlukan tindakan segera",
      icon: <Clock className="h-4 w-4 text-amber-500" />,
      header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-amber-100 dark:from-amber-900/50 dark:to-neutral-900 to-neutral-100 items-center justify-center text-4xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</div>
    },
    {
      title: "Verifikasi & Diterima", 
      value: (stats.verified + stats.accepted).toString(), 
      description: "Proses lanjut atau diterima",
      icon: <UserCheck className="h-4 w-4 text-emerald-500" />,
      header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-emerald-100 dark:from-emerald-900/50 dark:to-neutral-900 to-neutral-100 items-center justify-center text-4xl font-bold text-emerald-600 dark:text-emerald-400">{stats.verified + stats.accepted}</div>
    },
  ];

  const moduleCards = [
    {
      title: "Perpustakaan", icon: BookOpen, accent: "blue",
      items: [
        { label: "Total Buku", value: moduleStats.perpustakaan.totalBooks },
        { label: "Dipinjam", value: moduleStats.perpustakaan.activeLoans },
        { label: "Terlambat", value: moduleStats.perpustakaan.overdueLoans, alert: moduleStats.perpustakaan.overdueLoans > 0 },
      ],
      link: "/perpustakaan"
    },
    {
      title: "Inventaris", icon: Package, accent: "orange",
      items: [
        { label: "Total Aset", value: moduleStats.inventaris.totalAssets },
        { label: "Ruangan", value: moduleStats.inventaris.totalRooms },
        { label: "Perlu Perbaikan", value: moduleStats.inventaris.needsMaintenance, alert: moduleStats.inventaris.needsMaintenance > 0 },
      ],
      link: "/inventaris"
    },
    {
      title: "Tabungan", icon: Wallet, accent: "emerald",
      items: [
        { label: "Total Saldo", value: formatCurrency(moduleStats.tabungan.totalSaldo) },
        { label: "Siswa", value: moduleStats.tabungan.totalStudents },
        { label: "Transaksi Hari Ini", value: moduleStats.tabungan.todayTransactions },
      ],
      link: "/tabungan"
    },
  ];

  const quickActions = [
    { label: "Verifikasi SPMB", icon: Clock, href: "/spmb-admin", color: "bg-blue-100 text-blue-600", badge: stats.pending },
    { label: "Kelola Periode", icon: Calendar, href: "/spmb-admin/periods", color: "bg-purple-100 text-purple-600" },
    { label: "Peminjaman Buku", icon: BookMarked, href: "/perpustakaan/peminjaman", color: "bg-indigo-100 text-indigo-600" },
    { label: "Stock Opname", icon: Boxes, href: "/inventaris/opname", color: "bg-amber-100 text-amber-600" },
    { label: "Transaksi Tabungan", icon: DollarSign, href: "/tabungan/scan", color: "bg-emerald-100 text-emerald-600" },
    { label: "Pengumuman", icon: Bell, href: "/announcements", color: "bg-red-100 text-red-600" },
  ];

  return (
    <div className="space-y-8">
      {/* Teacher Dashboard Section */}
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <TeacherRoadmap stats={teacherStats} />
          
           <div>
             <h2 className="text-xl font-bold mb-4">Akses Cepat</h2>
             <QuickAccessCards />
           </div>
        </div>
        
        <div className="xl:w-80 shrink-0">
           <TeacherAssistantPanel stats={teacherStats} />
        </div>
      </div>

      {/* Module Stats Cards - 3D Effect */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {moduleCards.map((card) => (
          <Link key={card.title} href={card.link}>
            <CardContainer className="inter-var py-0">
               <CardBody className="bg-gradient-to-br from-white to-gray-50 dark:from-black dark:to-neutral-900 relative group/card dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1] dark:bg-black dark:border-white/[0.2] border-black/[0.1] w-full h-auto rounded-xl p-6 border transition-all duration-300">
                  <CardItem
                        translateZ="50"
                        className="text-xl font-bold text-neutral-600 dark:text-white flex items-center gap-2"
                  >
                        <card.icon className={`h-6 w-6 text-${card.accent}-500`} />
                        {card.title}
                  </CardItem>
                  <CardItem
                        as="p"
                        translateZ="60"
                        className="text-neutral-500 text-sm max-w-sm mt-2 dark:text-neutral-300"
                  >
                        Ringkasan data {card.title.toLowerCase()} terkini
                  </CardItem>
                  <div className="mt-8 grid grid-cols-1 gap-4">
                     {card.items.map((item, idx) => (
                        <CardItem key={idx} translateZ={40 + (idx * 10)} className="flex justify-between items-center w-full border-b border-neutral-100 dark:border-neutral-800 pb-2">
                             <span className="text-sm text-neutral-600 dark:text-neutral-400">{item.label}</span>
                             <span className={`font-bold ${'alert' in item && item.alert ? 'text-red-500' : 'text-neutral-800 dark:text-neutral-200'}`}>{item.value}</span>
                        </CardItem>
                     ))}
                  </div>
                  <div className="flex justify-between items-center mt-8">
                     <span className="px-4 py-2 rounded-xl text-xs font-normal dark:text-white bg-black/5 dark:bg-white/10">
                        Buka Menu →
                     </span>
                  </div>
               </CardBody>
            </CardContainer>
          </Link>
        ))}
      </div>

      {/* SPMB Stats Grid - Bento Grid */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Statistik SPMB
        </h2>
        <BentoGrid>
            {spmbCards.map((item, i) => (
                <BentoGridItem
                    key={i}
                    title={item.title}
                    description={item.description}
                    header={item.header}
                    icon={item.icon}
                    className={item.className}
                />
            ))}
            {/* Adding an extra chart item to the bento grid or keeping it separate? Keeping standard stats here. */}
        </BentoGrid>
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RegistrationTrendChart data={trendData} />
        </div>
        <div>
          <StatusDistributionChart data={statusData} />
        </div>
      </div>

      {/* System Health Monitor */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <ServerHealthDisplay health={serverHealth} />
      </div>

      {/* Main Table Section */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Pendaftar Terbaru</h2>
            <Link href="/spmb-admin">
              <Button variant="ghost" className="text-primary hover:text-primary/80">
                Lihat Semua <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>

          <Card className="border-none shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-medium">
                  <tr>
                    <th className="px-6 py-4">Nama Siswa</th>
                    <th className="px-6 py-4">Nomor</th>
                    <th className="px-6 py-4">Tanggal</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentRegistrants.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                        Belum ada pendaftar
                      </td>
                    </tr>
                  ) : (
                    recentRegistrants.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-medium">{item.student_name}</td>
                        <td className="px-6 py-4 font-mono text-muted-foreground">{item.registration_number}</td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(item.created).toLocaleDateString("id-ID")}
                        </td>
                        <td className="px-6 py-4"><SPMBStatusBadge status={item.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div>
            <h2 className="text-xl font-bold mb-4">Aksi Cepat</h2>
            <Card className="border-none shadow-md bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
              <CardContent className="p-4 grid grid-cols-2 gap-2">
                {quickActions.map((action) => (
                  <Link key={action.label} href={action.href}>
                    <Button 
                      variant="outline" 
                      className="w-full h-auto py-3 px-3 flex-col gap-2 text-xs font-normal hover:border-primary hover:text-primary transition-all relative"
                    >
                      <div className={`p-2 ${action.color} rounded-lg`}>
                        <action.icon className="h-4 w-4" />
                      </div>
                      {action.label}
                      {action.badge && action.badge > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                          {action.badge}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Aktivitas Terkini
            </h2>
            <Card className="border-none shadow-md">
              <CardContent className="p-4">
                <ScrollArea className="h-[200px]">
                  {recentActivities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-500" />
                      <p className="text-sm">Semua berjalan lancar!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentActivities.map((activity) => (
                        <div key={activity.id} className="flex gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className={`p-2 bg-muted rounded-lg ${activity.color}`}>
                            <activity.icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{activity.title}</p>
                            <p className="text-xs text-muted-foreground">{activity.description}</p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Period Info */}
          <Card className="bg-primary text-primary-foreground border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Info Periode SPMB
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activePeriod ? (
                <>
                  <div className="flex justify-between items-center border-b border-white/20 pb-2">
                    <span className="text-white/80">{activePeriod.name}</span>
                    <Badge className="bg-white text-primary hover:bg-white/90">Aktif</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Kuota Terisi</span>
                      <span className="font-bold">
                        {stats.accepted || 0}/{activePeriod.quota || 100}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white transition-all"
                        style={{
                          width: `${Math.min(((stats.accepted || 0) / (activePeriod.quota || 100)) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-white/80 text-sm">Tidak ada periode aktif</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Internal Component for Server Health (Only in Overview)
function ServerHealthDisplay({ health }: { health: any }) {
  if (!health) return null;
  return (
    <Card className="col-span-1 md:col-span-2 lg:col-span-3 border-none bg-gradient-to-r from-zinc-900 to-zinc-800 text-white shadow-xl">
      <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-500/20 rounded-full animate-pulse">
            <Activity className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg">System Status: {health.database?.status === 'Online' ? 'Healthy' : 'Degraded'}</h3>
            <p className="text-zinc-400 text-sm">Uptime: {(health.system?.uptime_seconds / 3600).toFixed(1)} hours</p>
          </div>
        </div>
        
        <div className="flex gap-8 text-sm">
          <div className="text-center">
            <p className="text-zinc-400">Database Size</p>
            <p className="font-mono font-bold">{health.database?.formatted_size}</p>
          </div>
          <div className="text-center">
            <p className="text-zinc-400">RAM Usage</p>
            <p className="font-mono font-bold">{health.system?.memory_usage_mb} MB</p>
          </div>
          <div className="text-center">
             <p className="text-zinc-400">Last Backup</p>
             <p className="font-mono font-bold">
                {health.backup?.last_backup ? new Date(health.backup.last_backup).toLocaleDateString() : 'Never'}
             </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
