import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  Calendar,
  ArrowRight,
  FileText,
  Sparkles,
  Info
} from "lucide-react";
import Link from "next/link";

// Mock stats - would ideally come from server
const stats = [
  {
    title: "Total Pendaftar",
    value: "156",
    change: "+12 minggu ini",
    icon: Users,
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
  },
  {
    title: "Menunggu Verifikasi",
    value: "23",
    change: "Perlu ditinjau",
    icon: Clock,
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
  },
  {
    title: "Terverifikasi",
    value: "98",
    change: "62.8% dari total",
    icon: UserCheck,
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  {
    title: "Ditolak",
    value: "12",
    change: "7.7% dari total",
    icon: UserX,
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
  },
];

const recentRegistrants = [
  { id: "1", name: "Ahmad Rizki", number: "SPMB-2024-0156", status: "pending", date: "2024-01-15" },
  { id: "2", name: "Siti Nurhaliza", number: "SPMB-2024-0155", status: "verified", date: "2024-01-14" },
  { id: "3", name: "Budi Santoso", number: "SPMB-2024-0154", status: "pending", date: "2024-01-14" },
  { id: "4", name: "Dewi Lestari", number: "SPMB-2024-0153", status: "accepted", date: "2024-01-13" },
  { id: "5", name: "Agus Prasetyo", number: "SPMB-2024-0152", status: "rejected", date: "2024-01-13" },
];

function getStatusBadge(status: string) {
  const styles = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    verified: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  };
  
  const labels = {
    pending: "Pending",
    verified: "Terverifikasi",
    accepted: "Diterima",
    rejected: "Ditolak"
  };

  return (
    <Badge variant="outline" className={styles[status as keyof typeof styles]}>
      {labels[status as keyof typeof labels] || status}
    </Badge>
  );
}

export default function OverviewPage() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Selamat Pagi," : hour < 18 ? "Selamat Siang," : "Selamat Malam,";

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-blue-600 p-8 md:p-10 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 rounded-full bg-black/10 blur-2xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {greeting} Admin! <span className="text-white/80">✨</span>
            </h1>
            <p className="text-blue-50 max-w-lg text-lg">
              Berikut adalah ringkasan aktivitas pendaftaran siswa baru hari ini.
              Ada <span className="font-bold underline">23 pendaftar</span> yang perlu verifikasi.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
             <Calendar className="h-4 w-4" />
             <span className="text-sm font-medium">
               {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
             </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="border bg-card/50 backdrop-blur hover:bg-card hover:shadow-md transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.text}`} />
                </div>
                <Badge variant="outline" className="text-xs font-normal">
                   <TrendingUp className="h-3 w-3 mr-1" />
                   {stat.change}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <h3 className="text-3xl font-bold tracking-tight">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Table Section */}
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
                   {recentRegistrants.map((item) => (
                     <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                       <td className="px-6 py-4 font-medium">{item.name}</td>
                       <td className="px-6 py-4 font-mono text-muted-foreground">{item.number}</td>
                       <td className="px-6 py-4 text-muted-foreground">{item.date}</td>
                       <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </Card>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
           <h2 className="text-xl font-bold">Aksi Cepat</h2>
           <Card className="border-none shadow-md bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
             <CardContent className="p-6 space-y-3">
               <Button variant="outline" className="w-full justify-start h-12 text-base font-normal hover:border-primary hover:text-primary transition-all">
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded mr-3">
                    <Clock className="h-4 w-4" />
                  </div>
                  Verifikasi Pending
               </Button>
               <Button variant="outline" className="w-full justify-start h-12 text-base font-normal hover:border-primary hover:text-primary transition-all">
                  <div className="p-1.5 bg-purple-100 text-purple-600 rounded mr-3">
                    <Calendar className="h-4 w-4" />
                  </div>
                  Kelola Periode
               </Button>
               <Button variant="outline" className="w-full justify-start h-12 text-base font-normal hover:border-primary hover:text-primary transition-all">
                  <div className="p-1.5 bg-orange-100 text-orange-600 rounded mr-3">
                    <FileText className="h-4 w-4" />
                  </div>
                  Buat Pengumuman
               </Button>
             </CardContent>
           </Card>

           <Card className="bg-primary text-primary-foreground border-none shadow-lg">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Info className="h-5 w-5" />
                 Info Periode
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="flex justify-between items-center border-b border-white/20 pb-2">
                  <span className="text-white/80">Gelombang 1</span>
                  <Badge className="bg-white text-primary hover:bg-white/90">Aktif</Badge>
                </div>
                <div className="space-y-1">
                   <div className="flex justify-between text-sm">
                     <span>Terisi</span>
                     <span className="font-bold">98/100</span>
                   </div>
                   <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white w-[98%]" />
                   </div>
                </div>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
