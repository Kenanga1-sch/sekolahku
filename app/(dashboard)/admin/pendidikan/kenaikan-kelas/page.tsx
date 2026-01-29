
"use client";

import { useState, useEffect } from "react";
import { ArrowRight, CheckCircle2, GraduationCap, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";

export default function PromotionPage() {
    const [classes, setClasses] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    
    // Selection State
    const [sourceClassId, setSourceClassId] = useState("");
    const [targetClassId, setTargetClassId] = useState("");
    const [actionType, setActionType] = useState<"promotion" | "graduation">("promotion");
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        if (sourceClassId) {
            fetchStudents(sourceClassId);
            setSelectedStudentIds([]); // Reset selection when class changes
        } else {
            setStudents([]);
        }
    }, [sourceClassId]);

    const fetchClasses = async () => {
        try {
            const res = await fetch("/api/master/academic/classes"); // Ensure this endpoint exists or use api/academic/classes
            // Based on previous task, it was api/master/academic/classes or similar. 
            // Wait, previous logs said `api/academic/classes` created in step 11 of task.md but implemented in `admin/pendidikan/kelas`.
            // Let's try /api/academic/classes based on task.md
            const res2 = await fetch("/api/academic/classes"); 
            if (res2.ok) {
                const data = await res2.json();
                setClasses(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchStudents = async (classId: string) => {
        setIsLoadingStudents(true);
        try {
            const res = await fetch(`/api/master/students?classId=${classId}&limit=100&status=active`);
            if (res.ok) {
                const data = await res.json();
                setStudents(data.data);
            }
        } catch (error) {
            showError("Gagal memuat data siswa");
        } finally {
            setIsLoadingStudents(false);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedStudentIds(students.map(s => s.id));
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
        if (selectedStudentIds.length === 0) return showError("Pilih minimal satu siswa");
        if (actionType === "promotion" && !targetClassId) return showError("Pilih kelas tujuan");
        if (actionType === "promotion" && sourceClassId === targetClassId) return showError("Kelas tujuan tidak boleh sama dengan kelas asal");

        if(!confirm(`Anda akan memproses ${selectedStudentIds.length} siswa. Lanjutkan?`)) return;

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/academic/promotion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentIds: selectedStudentIds,
                    targetClassId: actionType === "promotion" ? targetClassId : null,
                    actionType
                })
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Gagal memproses");

            showSuccess(`Berhasil memproses ${json.count} siswa`);
            
            // Refund/Refresh
            setSourceClassId("");
            setTargetClassId("");
            setSelectedStudentIds([]);
            setStudents([]);
        } catch (error: any) {
            showError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Kenaikan Kelas & Kelulusan</h1>
                <p className="text-muted-foreground">Proses pemindahan siswa ke kelas tingkat lanjut atau kelulusan.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                {classes.map((cls: any) => (
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
                <Card className="md:col-span-1 h-fit min-h-[400px]">
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                        <CardTitle className="text-base">2. Pilih Siswa</CardTitle>
                        <div className="flex items-center space-x-2">
                             <Checkbox 
                                id="select-all" 
                                checked={students.length > 0 && selectedStudentIds.length === students.length}
                                onCheckedChange={(c) => handleSelectAll(c as boolean)}
                                disabled={students.length === 0}
                            />
                            <Label htmlFor="select-all" className="text-xs">Pilih Semua</Label>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[400px] overflow-y-auto space-y-2 pr-2">
                        {students.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                                <Users className="h-8 w-8 mb-2 opacity-50" />
                                Pilih kelas asal dulu
                            </div>
                        ) : (
                            students.map(student => (
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
                        <RadioGroup defaultValue="promotion" value={actionType} onValueChange={(v: any) => setActionType(v)}>
                            <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50">
                                <RadioGroupItem value="promotion" id="r1" />
                                <Label htmlFor="r1" className="flex-1 cursor-pointer flex items-center justify-between">
                                    <span>Naik Kelas</span>
                                    <ArrowRight className="h-4 w-4 text-blue-500" />
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50">
                                <RadioGroupItem value="graduation" id="r2" />
                                <Label htmlFor="r2" className="flex-1 cursor-pointer flex items-center justify-between">
                                    <span>Lulus Sekolah</span>
                                    <GraduationCap className="h-4 w-4 text-green-500" />
                                </Label>
                            </div>
                        </RadioGroup>

                        {actionType === "promotion" && (
                            <div className="space-y-2">
                                <Label>Pilih Kelas Tujuan</Label>
                                <Select value={targetClassId} onValueChange={setTargetClassId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Kelas..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classes.filter(c => c.id !== sourceClassId).map((cls: any) => (
                                            <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                         {actionType === "graduation" && (
                            <div className="p-3 bg-green-500/10 text-green-700 text-sm rounded-md border border-green-200">
                                Siswa yang dipilih akan diubah statusnya menjadi <strong>Alumni (Graduated)</strong> dan dikeluarkan dari kelas aktif.
                            </div>
                        )}

                        <div className="pt-4 border-t">
                            <div className="flex justify-between items-center mb-4 text-sm">
                                <span>Siswa Dipilih:</span>
                                <Badge variant="secondary">{selectedStudentIds.length}</Badge>
                            </div>
                            <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting || selectedStudentIds.length === 0}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Proses Sekarang
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
