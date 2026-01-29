
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
    ArrowLeft, 
    FileText, 
    Upload, 
    Trash2, 
    Eye, 
    Loader2, 
    CheckCircle2, 
    AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from "@/lib/toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default function StudentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const studentId = params.id as string;

    const [student, setStudent] = useState<any>(null);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Upload State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [docType, setDocType] = useState("lainnya");
    const [docTitle, setDocTitle] = useState("");

    useEffect(() => {
        fetchData();
    }, [studentId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Student
            const resStudent = await fetch(`/api/master/students/${studentId}`);
            if (!resStudent.ok) throw new Error("Siswa tidak ditemukan");
            const dataStudent = await resStudent.json();
            setStudent(dataStudent);

            // Fetch Documents
            await fetchDocuments();
        } catch (error) {
            console.error(error);
            showError("Gagal memuat data");
            router.push("/admin/master/siswa");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDocuments = async () => {
        try {
            const resDocs = await fetch(`/api/master/students/${studentId}/documents`);
            if (resDocs.ok) {
                const dataDocs = await resDocs.json();
                setDocuments(dataDocs);
            }
        } catch(e) { console.error(e); }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile) return showError("Pilih file dulu");

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("title", docTitle || uploadFile.name);
        formData.append("type", docType);

        try {
            const res = await fetch(`/api/master/students/${studentId}/documents`, {
                method: "POST",
                body: formData
            });

            if (!res.ok) throw new Error("Gagal upload");
            
            showSuccess("Dokumen berhasil diupload");
            setUploadFile(null);
            setDocTitle("");
            await fetchDocuments();
        } catch (error) {
            showError("Gagal upload dokumen");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteDoc = async (docId: string) => {
        if(!confirm("Hapus dokumen ini?")) return;
        try {
            const res = await fetch(`/api/master/students/${studentId}/documents?docId=${docId}`, {
                method: "DELETE"
            });
            if(res.ok) {
                showSuccess("Dokumen dihapus");
                fetchDocuments();
            } else {
                showError("Gagal hapus");
            }
        } catch (e) { showError("Error"); }
    };

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
    if (!student) return <div>Siswa tidak ditemukan</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{student.fullName}</h1>
                    <div className="flex gap-2 text-muted-foreground text-sm">
                        <span>{student.nisn || "No NISN"}</span>
                        <span>•</span>
                        <span>{student.className || "Tanpa Kelas"}</span>
                        <span>•</span>
                        <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>{student.status}</Badge>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="documents">
                <TabsList>
                    <TabsTrigger value="profile">Profil</TabsTrigger>
                    <TabsTrigger value="documents">Dokumen Pendukung</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Data Pribadi</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-muted-foreground">NIK</Label>
                                    <div className="font-medium">{student.nik || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Tempat, Tanggal Lahir</Label>
                                    <div className="font-medium">{student.birthPlace}, {student.birthDate}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Nama Ibu Kandung</Label>
                                    <div className="font-medium">{student.motherName || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Alamat</Label>
                                    <div className="font-medium">{student.address || "-"}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="documents" className="pt-4 space-y-6">
                    {/* Upload Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Upload className="h-4 w-4" /> Upload Dokumen Baru
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 item-end">
                                <div className="flex-1 space-y-2">
                                    <Label>Judul Dokumen</Label>
                                    <Input 
                                        placeholder="Contoh: Kartu Keluarga 2024" 
                                        value={docTitle}
                                        onChange={(e) => setDocTitle(e.target.value)}
                                        required 
                                    />
                                </div>
                                <div className="w-[200px] space-y-2">
                                    <Label>Jenis</Label>
                                    <Select value={docType} onValueChange={setDocType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="kk">Kartu Keluarga (KK)</SelectItem>
                                            <SelectItem value="akta">Akta Kelahiran</SelectItem>
                                            <SelectItem value="kip">KIP / Bansos</SelectItem>
                                            <SelectItem value="ijazah_tk">Ijazah TK</SelectItem>
                                            <SelectItem value="foto">Pas Foto</SelectItem>
                                            <SelectItem value="lainnya">Lainnya</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Label>File (Max 5MB)</Label>
                                    <Input 
                                        type="file" 
                                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                        accept=".pdf,.jpg,.jpeg,.png"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <Button type="submit" disabled={isUploading}>
                                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Upload
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Documents List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {documents.length === 0 ? (
                            <div className="col-span-full text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                                <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                Belum ada dokumen diupload
                            </div>
                        ) : (
                            documents.map(doc => (
                                <Card key={doc.id} className="group hover:border-primary/50 transition-colors">
                                    <CardContent className="p-4 flex items-start gap-3">
                                        <div className="mt-1 h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                                            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium truncate" title={doc.title}>{doc.title}</h4>
                                            <p className="text-xs text-muted-foreground capitalize mb-2">{doc.type.replace('_', ' ')}</p>
                                            <div className="text-xs text-muted-foreground">
                                                {format(new Date(doc.uploadedAt), "d MMM yyyy", { locale: id })}
                                            </div>
                                        </div>
                                    </CardContent>
                                    <div className="p-3 border-t bg-muted/20 flex items-center justify-end gap-2">
                                        <Button variant="ghost" size="sm" asChild>
                                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                                <Eye className="h-3 w-3 mr-1" /> Lihat
                                            </a>
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteDoc(doc.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
