export interface Alumni {
  id: string;
  nisn: string | null;
  nis: string | null;
  fullName: string;
  gender: string | null;
  graduationYear: string;
  finalClass: string | null;
  photo: string | null;
  nextSchool: string | null;
  status: string;
  bukuFisikNo: string | null;
  registerNo: number | null;
  createdAt: Date;
}

export interface AlumniStats {
  totalAlumni: number;
  totalDocuments: number;
  pendingVerification: number;
  activeCount: number;
  graduatedCount: number;
  transferredCount: number;
  droppedCount: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface QuickIndexForm {
  fullName: string;
  nisn: string;
  graduationYear: string;
  bukuFisikNo: string;
  registerNo: string;
}

export const statusInfo: Record<string, { label: string; color: string; border: string }> = {
  active: {
    label: "Aktif",
    color: "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20",
    border: "border-emerald-500/30",
  },
  graduated: {
    label: "Alumni",
    color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20",
    border: "border-blue-500/30",
  },
  transferred: {
    label: "Pindahan",
    color: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20",
    border: "border-amber-500/30",
  },
  dropped: {
    label: "Keluar",
    color: "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20",
    border: "border-rose-500/30",
  },
};
