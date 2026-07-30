"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Edit, Trash2, Printer, User, School, Phone, MapPin } from "lucide-react";
import Link from "next/link";
import type { AlumniDetail } from "./types-alumni";

interface ProfileHeaderProps {
  alumni: AlumniDetail;
  onDelete: () => void;
}

export function ProfileHeader({ alumni, onDelete }: ProfileHeaderProps) {
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/siswa">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{alumni.fullName}</h1>
              <Badge variant="outline" className={
                alumni.status === "graduated" ? "bg-blue-500/10 text-blue-500" :
                alumni.status === "active" ? "bg-emerald-500/10 text-emerald-500" :
                "bg-secondary text-secondary-foreground"
              }>
                {alumni.status === "graduated" ? `Alumni (Lulus ${alumni.graduationYear})` :
                 alumni.status === "active" ? "Siswa Aktif" :
                 alumni.status === "transferred" ? "Siswa Pindahan (Mutasi)" : "Siswa Keluar / DO"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/siswa/alumni-detail/edit?id=${alumni.id}`}>
            <Button variant="outline" size="sm"><Edit className="h-4 w-4 mr-1" />Edit</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => window.open(`/admin/siswa/buku-induk/print?id=${alumni.id}&type=alumni`, "_blank")}>
            <Printer className="h-4 w-4 mr-1" />Cetak Buku Induk
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" />Hapus</Button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <Avatar className="h-20 w-20 shrink-0 border-2 border-slate-100 dark:border-zinc-800">
                <AvatarImage src={alumni.photo || undefined} />
                <AvatarFallback className="text-xl font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                  {alumni.fullName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 w-full text-center md:text-left space-y-4">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100">{alumni.fullName}</h3>
                  {alumni.status === "graduated" ? (
                    <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20 font-medium">Alumni (Lulus {alumni.graduationYear})</Badge>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20 font-medium">Siswa Aktif</Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-zinc-900/50">
                  {alumni.nisn && <InfoItem icon={<User className="h-4 w-4 text-slate-400 shrink-0" />} label="NISN / NIS">{alumni.nisn} {alumni.nis ? `/ ${alumni.nis}` : ""}</InfoItem>}
                  {alumni.finalClass && <InfoItem icon={<School className="h-4 w-4 text-slate-400 shrink-0" />} label="Kelas Akhir">Kelas {alumni.finalClass}</InfoItem>}
                  {(alumni.currentPhone || alumni.currentEmail) && <InfoItem icon={<Phone className="h-4 w-4 text-slate-400 shrink-0" />} label="Kontak" truncate>{alumni.currentPhone || alumni.currentEmail}</InfoItem>}
                  {alumni.currentAddress && <InfoItem icon={<MapPin className="h-4 w-4 text-slate-400 shrink-0" />} label="Alamat" truncate>{alumni.currentAddress}</InfoItem>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}

function InfoItem({ icon, label, children, truncate }: { icon: React.ReactNode; label: string; children: React.ReactNode; truncate?: boolean }) {
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className={`text-sm font-semibold flex items-center justify-center md:justify-start gap-2 text-slate-700 dark:text-zinc-300 ${truncate ? "truncate" : ""}`}>{icon}{children}</div>
    </div>
  );
}