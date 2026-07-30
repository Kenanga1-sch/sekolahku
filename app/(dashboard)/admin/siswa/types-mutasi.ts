export interface ClassStatsItem {
  id: string;
  name: string;
  grade: number;
  studentCount: number;
  capacity: number;
}

export interface MutasiRequest {
  id: string;
  studentName: string;
  nisn: string;
  nis?: string;
  registrationNumber?: string;
  originSchool?: string;
  originSchoolAddress?: string;
  targetGrade?: number;
  targetClassId?: string;
  statusApproval?: string;
  statusDelivery?: string;
  createdAt: string;
  gender?: string;
  className?: string;
  destinationSchool?: string;
  letterNo?: string;
  status?: string;
  parentName?: string;
  whatsappNumber?: string;
  reason?: string;
  reasonDetail?: string;
}

export interface LiabilityData {
  library?: {
    activeLoans: number;
    status: string;
  };
  financial?: {
    balance: number;
    status: string;
  };
  academic?: {
    grade: string;
    status: string;
  };
}

export interface MutasiLog {
  id?: string;
  studentName: string;
  nis?: string;
  nisn?: string;
  gender: string;
  className: string;
  classGrade?: number;
  mutasiType: "masuk" | "keluar";
  mutationDate?: string;
  originOrDestination?: string;
  originNis?: string;
  originClass?: string;
  approvalDate?: string;
  approvalNo?: string;
  letterNo?: string;
  destinationClass?: string;
}

export interface StudentItem {
  id: string;
  fullName: string;
  nis?: string;
  nisn?: string;
  className?: string;
}

export interface ReportRow {
  no: number;
  tanggal: string;
  nama: string;
  lp?: string;
  noInduk: string;
  kelas?: string;
  sekolah?: string;
  asalNoInduk?: string;
  asalKelas?: string;
  persetujuanTanggal?: string;
  persetujuanNomor?: string;
  nomorSurat?: string;
  tujuan?: string;
}

export interface RekapRow {
  grade: number | "Jumlah";
  awalL: string | number;
  awalP: string | number;
  awalJM: string | number;
  masukL: string | number;
  masukP: string | number;
  masukJM: string | number;
  keluarL: string | number;
  keluarP: string | number;
  keluarJM: string | number;
  akhirL: string | number;
  akhirP: string | number;
  akhirJM: string | number;
  keterangan: string;
}

export interface SchoolSettings {
  principal_name?: string;
  principal_nip?: string;
  supervisor_name?: string;
  supervisor_nip?: string;
  [key: string]: unknown;
}
