"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Calendar,
  Megaphone,
  Award,
  Users,
  FileText,
} from "lucide-react";

// Mock data
const initialAnnouncements = [
  {
    id: "1",
    title: "Pembukaan Pendaftaran Siswa Baru 2024/2025",
    category: "spmb",
    status: "published",
    date: "2024-01-15",
    views: 1250,
  },
  {
    id: "2",
    title: "Prestasi Olimpiade Matematika Provinsi",
    category: "prestasi",
    status: "published",
    date: "2024-01-10",
    views: 890,
  },
  {
    id: "3",
    title: "Jadwal Ujian Akhir Semester",
    category: "pengumuman",
    status: "draft",
    date: "2024-01-08",
    views: 0,
  },
  {
    id: "4",
    title: "Kegiatan Pentas Seni Akhir Tahun",
    category: "kegiatan",
    status: "published",
    date: "2024-01-05",
    views: 567,
  },
];

const categories = [
  { value: "spmb", label: "SPMB", icon: Users },
  { value: "prestasi", label: "Prestasi", icon: Award },
  { value: "kegiatan", label: "Kegiatan", icon: Calendar },
  { value: "pengumuman", label: "Pengumuman", icon: Megaphone },
];

function getCategoryColor(category: string) {
  switch (category) {
    case "spmb": return "bg-blue-100 text-blue-700";
    case "prestasi": return "bg-amber-100 text-amber-700";
    case "kegiatan": return "bg-green-100 text-green-700";
    case "pengumuman": return "bg-purple-100 text-purple-700";
    default: return "bg-zinc-100 text-zinc-700";
  }
}

function getStatusColor(status: string) {
  return status === "published"
    ? "bg-green-100 text-green-700"
    : "bg-zinc-100 text-zinc-700";
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    content: "",
    status: "draft",
  });

  const filteredAnnouncements = announcements.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSubmit = () => {
    if (editingId) {
      setAnnouncements(announcements.map(a => 
        a.id === editingId 
          ? { ...a, ...formData, date: new Date().toISOString().split("T")[0] }
          : a
      ));
    } else {
      const newAnnouncement = {
        id: Date.now().toString(),
        title: formData.title,
        category: formData.category,
        status: formData.status,
        date: new Date().toISOString().split("T")[0],
        views: 0,
      };
      setAnnouncements([newAnnouncement, ...announcements]);
    }
    resetForm();
  };

  const handleEdit = (item: typeof initialAnnouncements[0]) => {
    setEditingId(item.id);
    setFormData({
      title: item.title,
      category: item.category,
      content: "",
      status: item.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setAnnouncements(announcements.filter(a => a.id !== id));
  };

  const resetForm = () => {
    setFormData({ title: "", category: "", content: "", status: "draft" });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Berita & Pengumuman</h1>
          <p className="text-muted-foreground">Kelola berita dan pengumuman sekolah</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => resetForm()}>
              <Plus className="h-4 w-4" />
              Tambah Berita
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Berita" : "Tambah Berita Baru"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Perbarui informasi berita" : "Buat berita atau pengumuman baru"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Judul</Label>
                <Input
                  id="title"
                  placeholder="Masukkan judul berita"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Konten</Label>
                <Textarea
                  id="content"
                  placeholder="Tulis isi berita..."
                  rows={6}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Batal</Button>
              <Button onClick={handleSubmit}>
                {editingId ? "Simpan Perubahan" : "Publikasikan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Berita", value: announcements.length, icon: FileText, color: "text-blue-600" },
          { label: "Published", value: announcements.filter(a => a.status === "published").length, icon: Eye, color: "text-green-600" },
          { label: "Draft", value: announcements.filter(a => a.status === "draft").length, icon: Pencil, color: "text-amber-600" },
          { label: "Total Views", value: announcements.reduce((acc, a) => acc + a.views, 0).toLocaleString(), icon: Eye, color: "text-purple-600" },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berita..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judul</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAnnouncements.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium max-w-[300px] truncate">
                    {item.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getCategoryColor(item.category)}>
                      {categories.find(c => c.value === item.category)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getStatusColor(item.status)}>
                      {item.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">{item.views.toLocaleString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(item)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAnnouncements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Tidak ada berita ditemukan
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
