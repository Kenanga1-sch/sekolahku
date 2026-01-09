"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Download,
  Users,
} from "lucide-react";
import { formatDate, getStatusLabel, getStatusColor } from "@/lib/utils";

// Mock data - will be fetched from PocketBase
const mockRegistrants = [
  {
    id: "1",
    registration_number: "SPMB-2024-0156",
    full_name: "Ahmad Rizki Pratama",
    nik: "3201234567890001",
    gender: "L",
    distance_to_school: 1.5,
    is_within_zone: true,
    status: "pending",
    created: "2024-01-15T10:30:00",
  },
  {
    id: "2",
    registration_number: "SPMB-2024-0155",
    full_name: "Siti Nurhaliza",
    nik: "3201234567890002",
    gender: "P",
    distance_to_school: 2.8,
    is_within_zone: true,
    status: "verified",
    created: "2024-01-14T14:20:00",
  },
  {
    id: "3",
    registration_number: "SPMB-2024-0154",
    full_name: "Budi Santoso",
    nik: "3201234567890003",
    gender: "L",
    distance_to_school: 0.8,
    is_within_zone: true,
    status: "accepted",
    created: "2024-01-14T09:15:00",
  },
  {
    id: "4",
    registration_number: "SPMB-2024-0153",
    full_name: "Dewi Lestari Putri",
    nik: "3201234567890004",
    gender: "P",
    distance_to_school: 4.2,
    is_within_zone: false,
    status: "pending",
    created: "2024-01-13T16:45:00",
  },
  {
    id: "5",
    registration_number: "SPMB-2024-0152",
    full_name: "Agus Prasetyo",
    nik: "3201234567890005",
    gender: "L",
    distance_to_school: 5.1,
    is_within_zone: false,
    status: "rejected",
    created: "2024-01-13T11:00:00",
  },
];

export default function SPMBAdminPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredRegistrants = mockRegistrants.filter((r) => {
    const matchesSearch =
      r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.registration_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pendaftar SPMB</h1>
          <p className="text-muted-foreground">
            Kelola dan verifikasi data pendaftar siswa baru
          </p>
        </div>
        <Button className="gap-2">
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">156</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-amber-600">23</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Terverifikasi</div>
          <div className="text-2xl font-bold text-blue-600">35</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Diterima</div>
          <div className="text-2xl font-bold text-green-600">86</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Ditolak</div>
          <div className="text-2xl font-bold text-red-600">12</div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau nomor pendaftaran..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Terverifikasi</SelectItem>
                <SelectItem value="accepted">Diterima</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>No. Pendaftaran</TableHead>
                  <TableHead>Nama Lengkap</TableHead>
                  <TableHead className="hidden md:table-cell">Jarak</TableHead>
                  <TableHead className="hidden lg:table-cell">Zonasi</TableHead>
                  <TableHead className="hidden md:table-cell">Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">Tidak ada data ditemukan</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegistrants.map((registrant) => (
                    <TableRow key={registrant.id}>
                      <TableCell className="font-mono text-sm">
                        {registrant.registration_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{registrant.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {registrant.gender === "L" ? "Laki-laki" : "Perempuan"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {registrant.distance_to_school.toFixed(1)} km
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge
                          variant={registrant.is_within_zone ? "default" : "secondary"}
                          className={
                            registrant.is_within_zone
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }
                        >
                          {registrant.is_within_zone ? "Dalam" : "Luar"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {formatDate(registrant.created)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(registrant.status)}>
                          {getStatusLabel(registrant.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/spmb/${registrant.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Lihat Detail
                              </Link>
                            </DropdownMenuItem>
                            {registrant.status === "pending" && (
                              <>
                                <DropdownMenuItem className="text-green-600">
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Verifikasi
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Tolak
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination placeholder */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Menampilkan {filteredRegistrants.length} dari 156 pendaftar
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Sebelumnya
              </Button>
              <Button variant="outline" size="sm">
                Selanjutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
