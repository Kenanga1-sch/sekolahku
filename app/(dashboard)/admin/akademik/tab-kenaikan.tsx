"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Users, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { goGet, goPost } from "@/lib/api-client";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ClassOption {
    id: string;
    name: string;
}

interface StudentPromotion {
    id: string;
    fullName: string;
    nisn?: string;
    nis?: string;
}

export default function TabKenaikan() {
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [students, setStudents] = useState<StudentPromotion[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Selection State
    const [sourceClassId, setSourceClassId] = useState("");
    const [targetClassId, setTargetClassId] = useState("");
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        if (sourceClassId) {
            fetchStudents(sourceClassId);
            setSelectedStudentIds([]); // Reset selection when class changes
            setSearchQuery("");
        } else {
            setStudents([]);
        }
    }, [sourceClassId]);

    const fetchClasses = async () => {
        try {
            const data: any = await goGet("/api/academic/classes");
            setClasses(data as any[]);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchStudents = async (classId: string) => {
        setIsLoadingStudents(true);
        try {
            const response: any = await goGet(`/api/master/students?classId=${classId}&limit=100&status=active`);
            const result = response?.data ?? response;
            const studentsArray = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);
            setStudents(studentsArray);
        } catch (error) {
            showError("Gagal memuat data siswa");
        } finally {
            setIsLoadingStudents(false);
        }
    };

    const filteredStudents = students.filter((student) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            student.fullName.toLowerCase().includes(q) ||
            student.nisn?.toLowerCase().includes(q) ||
            student.nis?.toLowerCase().includes(q)
        );
    });

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedStudentIds(filteredStudents.map(s => s.id));
        } else {
            setSelectedStudentIds([]);
        }
    };

    const handleSelectStudent = (studentId: string, checked: boolean) => {
        if (checked) {
            setSelectedStudentIds(prev => [...prev, studentId]);
        } else {
            setSelectedStudentIds(prev => prev.filter(id => id !== studentId));
        }
    };

    const handleSubmit = async () => {
        setIsConfirmOpen(false);
        setIsSubmitting(true);
        try {
            const json: any = await goPost("/api/academic/promotion", {
                studentIds: selectedStudentIds,
                targetClassId,
            });

            showSuccess(`Berhasil memproses ${json.count} siswa`);

            // Refund/Refresh
            setSourceClassId("");
            setTargetClassId("");
            setSelectedStudentIds([]);
            setStudents([]);
        } catch (error) {
            showError(error instanceof Error ? error.message : "Gagal memproses");
        } finally {
            setIsSubmitting(false);
        }
    };

    const requestSubmit = () => {
        if (selectedStudentIds.length === 0) return showError("Pilih minimal satu siswa");
        if (!targetClassId) return showError("Pilih kelas tujuan");
        if (sourceClassId === targetClassId) return showError("Kelas tujuan tidak boleh sama dengan kelas asal");
        setIsConfirmOpen(true);
    };

    const sourceClassName = classes.find(c => c.id === sourceClassId)?.name || "-";
    const targetClassName = classes.find(c => c.id === targetClassId)?.name || "-";

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* LEFT: SOURCE CLASS */}
            <Card className="md:col-span-1 h-fit">
                <CardHeader>
                    <CardTitle className="text-base">1. Pilih Kelas Asal</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select value={sourceClassId} onValueChange={setSourceClassId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih Kelas..." />
                        </SelectTrigger>
                        <SelectContent>
                            {classes.map((cls: { id: string; name: string }) => (
                                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {sourceClassId && (
                        <div className="mt-4 text-sm text-muted-foreground">
                            {isLoadingStudents ? <Loader2 className="h-4 w-4 animate-spin" /> : `${students.length} Siswa Aktif`}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* MIDDLE: STUDENTS LIST */}
            <Card className="md:col-span-1 h-fit md:min-h-[400px] flex flex-col">
                <CardHeader className="flex flex-col gap-3 py-4">
                    <div className="flex flex-row items-center justify-between gap-2">
                        <CardTitle className="text-base">2. Pilih Siswa</CardTitle>
                        <div className="flex items-center space-x-2">
                             <Checkbox
                                id="select-all"
                                checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length}
                                onCheckedChange={(c) => handleSelectAll(c as boolean)}
                                disabled={filteredStudents.length === 0}
                            />
                            <Label htmlFor="select-all" className="text-xs">Pilih Semua</Label>
                        </div>
                    </div>
                    {students.length > 0 && (
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari nama, NISN, atau NIS..."
                                className="pl-8 h-9"
                            />
                        </div>
                    )}
                </CardHeader>
                <CardContent className="flex-1 min-h-0 h-[45vh] md:h-[400px] overflow-y-auto space-y-2 pr-2">
                    {filteredStudents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                            <Users className="h-8 w-8 mb-2 opacity-50" />
                            {students.length === 0
                                ? (sourceClassId && !isLoadingStudents ? "Tidak ada siswa aktif di kelas ini" : "Pilih kelas asal dulu")
                                : "Tidak ada siswa yang cocok dengan pencarian"}
                        </div>
                    ) : (
                        filteredStudents.map((student: { id: string; fullName: string; nisn?: string; nis?: string }) => (
                            <div key={student.id} className="flex items-center p-2 border rounded-md hover:bg-muted/50 transition-colors bg-card">
                                <Checkbox
                                    id={student.id}
                                    checked={selectedStudentIds.includes(student.id)}
                                    onCheckedChange={(c) => handleSelectStudent(student.id, c as boolean)}
                                />
                                <Label htmlFor={student.id} className="ml-3 flex-1 cursor-pointer">
                                    <div className="font-medium text-sm">{student.fullName}</div>
                                    <div className="text-xs text-muted-foreground">{student.nisn || student.nis}</div>
                                </Label>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* RIGHT: TARGET & ACTION */}
             <Card className="md:col-span-1 h-fit">
                <CardHeader>
                    <CardTitle className="text-base">3. Tujuan & Eksekusi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Pilih Kelas Tujuan</Label>
                        <Select value={targetClassId} onValueChange={setTargetClassId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Kelas..." />
                            </SelectTrigger>
                            <SelectContent>
                                {classes.filter((c: { id: string }) => c.id !== sourceClassId).map((cls: { id: string; name: string }) => (
                                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="pt-4 border-t">
                        <div className="flex justify-between items-center mb-4 text-sm">
                            <span>Siswa Dipilih:</span>
                            <Badge variant="secondary">{selectedStudentIds.length}</Badge>
                        </div>
                        <Button className="w-full" onClick={requestSubmit} disabled={isSubmitting || selectedStudentIds.length === 0}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Naikkan Kelas
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Naikkan {selectedStudentIds.length} siswa?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Siswa dari kelas <span className="font-medium text-foreground">{sourceClassName}</span> akan dipindahkan ke kelas{" "}
                            <span className="font-medium text-foreground">{targetClassName}</span>. Tindakan ini tercatat di riwayat kelas siswa.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSubmit}>Ya, Naikkan Kelas</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
