// Tipe bersama modul Hutang Tabungan — dipakai page & dialog-dialognya.

export interface Hutang {
  id: string;
  siswaId: string;
  namaBarang: string;
  kategori: string;
  nominal: number;
  jumlah: number;
  terbayar: number;
  status: string;
  tanggalAmbil: string | null;
  catatan: string | null;
  tahunAjaran: string | null;
  siswa?: { id: string; nama: string; nisn: string; kelas: string | null } | null;
  pencatat?: { name: string; email: string } | null;
}

export interface Siswa {
  id: string;
  nama: string;
  nisn: string;
  kelasId: string;
  kelas?: { nama: string } | null;
  saldoTerakhir?: number;
}

export interface PaymentHistoryItem {
  id: string;
  hutangId: string;
  nominal: number;
  metode: "cash" | "tabungan";
  transaksiId?: string | null;
  dicatatOleh: string;
  createdAt: number;
}
