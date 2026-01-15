"use client";

import { useEffect, useState, useCallback } from "react";
import {
    ClipboardList,
    Plus,
    Calendar,
    User,
    CheckCircle,
    Clock,
    ArrowRight,
    Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    getOpnameSessions,
    createOpnameSession,
    getAllRooms,
    getAssets,
    applyOpnameSession,
} from "@/lib/inventory";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { InventoryOpname, InventoryRoom, OpnameItem } from "@/types/inventory";

// Sub-component for Opname Form
function OpnameForm({
    rooms,
    onSuccess,
    onCancel
}: {
    rooms: InventoryRoom[],
    onSuccess: () => void,
    onCancel: () => void
}) {
    const { user } = useAuthStore();
    const [selectedRoom, setSelectedRoom] = useState("");
    const [items, setItems] = useState<OpnameItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Select Room, 2: Count Items

    const handleRoomSelect = async () => {
        if (!selectedRoom) return;
        setLoading(true);
        try {
            // Fetch assets in this room to audit
            // NOTE: fetching all assets for now, pagination handling might be needed for large rooms
            const result = await getAssets(1, 500, `room = "${selectedRoom}"`);

            const opnameItems: OpnameItem[] = result.items.map(asset => ({
                assetId: asset.id,
                assetName: asset.name,
                assetCode: asset.code,
                systemQty: asset.quantity,
                // Default to current system values
                qtyGood: asset.condition_good,
                qtyLightDamage: asset.condition_light_damaged,
                qtyHeavyDamage: asset.condition_heavy_damaged,
                qtyLost: asset.condition_lost,
            }));

            setItems(opnameItems);
            setStep(2);
        } catch (error) {
            console.error("Failed to load assets:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleItemChange = (index: number, field: keyof OpnameItem, value: number | string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleSubmit = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await createOpnameSession({
                date: new Date().toISOString(),
                room: selectedRoom,
                auditor: user.id,
                items: items,
                status: "PENDING",
                note: `Stok Opname oleh ${user.name}`,
            });
            onSuccess();
        } catch (error) {
            console.error("Failed to save opname:", error);
        } finally {
            setLoading(false);
        }
    };

    if (step === 1) {
        return (
            <div className="space-y-4 py-4">
                <div className="grid gap-2">
                    <Label>Pilih Ruangan untuk Di-audit</Label>
                    <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih Ruangan" />
                        </SelectTrigger>
                        <SelectContent>
                            {rooms.map((room) => (
                                <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>Batal</Button>
                    <Button onClick={handleRoomSelect} disabled={!selectedRoom || loading}>
                        {loading ? "Memuat..." : "Mulai Opname"}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 py-4">
            <div className="max-h-[60vh] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Aset</TableHead>
                            <TableHead className="w-[80px]">System</TableHead>
                            <TableHead className="w-[80px]">Baik</TableHead>
                            <TableHead className="w-[80px]">RR</TableHead>
                            <TableHead className="w-[80px]">RB</TableHead>
                            <TableHead className="w-[80px]">Hilang</TableHead>
                            <TableHead>Catatan</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, idx) => (
                            <TableRow key={item.assetId}>
                                <TableCell>
                                    <p className="font-medium text-sm">{item.assetName}</p>
                                    <p className="text-xs text-muted-foreground">{item.assetCode}</p>
                                </TableCell>
                                <TableCell>{item.systemQty}</TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        className="h-8 w-16"
                                        value={item.qtyGood}
                                        onChange={(e) => handleItemChange(idx, "qtyGood", parseInt(e.target.value) || 0)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        className="h-8 w-16"
                                        value={item.qtyLightDamage}
                                        onChange={(e) => handleItemChange(idx, "qtyLightDamage", parseInt(e.target.value) || 0)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        className="h-8 w-16"
                                        value={item.qtyHeavyDamage}
                                        onChange={(e) => handleItemChange(idx, "qtyHeavyDamage", parseInt(e.target.value) || 0)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        className="h-8 w-16"
                                        value={item.qtyLost}
                                        onChange={(e) => handleItemChange(idx, "qtyLost", parseInt(e.target.value) || 0)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        className="h-8"
                                        placeholder="Catatan..."
                                        value={item.notes || ""}
                                        onChange={(e) => handleItemChange(idx, "notes", e.target.value)}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                    Total items: {items.length}
                </p>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? "Menyimpan..." : "Simpan Hasil Opname"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function OpnamePage() {
    const [sessions, setSessions] = useState<InventoryOpname[]>([]);
    const [rooms, setRooms] = useState<InventoryRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [sessionsData, roomsData] = await Promise.all([
                getOpnameSessions(),
                getAllRooms(),
            ]);
            setSessions(sessionsData.items);
            setRooms(roomsData);
        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleApply = async (id: string) => {
        if (confirm("Terapkan hasil opname ini ke database aset? Aksi ini tidak dapat dibatalkan.")) {
            const success = await applyOpnameSession(id);
            if (success) {
                alert("Berhasil diterapkan!");
                loadData();
            } else {
                alert("Gagal menerapkan opname.");
            }
        }
    };

    const formatDate = (str: string) => {
        return new Date(str).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Stok Opname</h1>
                    <p className="text-muted-foreground">
                        Lakukan audit fisik aset secara berkala
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Mulai Opname Baru
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>Stok Opname Baru</DialogTitle>
                            <DialogDescription>
                                Pilih ruangan dan lakukan update jumlah fisik aset
                            </DialogDescription>
                        </DialogHeader>
                        <OpnameForm
                            rooms={rooms}
                            onSuccess={() => {
                                setIsDialogOpen(false);
                                loadData();
                            }}
                            onCancel={() => setIsDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {/* History Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Riwayat Opname</CardTitle>
                    <CardDescription>Daftar sesi stok opname sebelumnya</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Ruangan</TableHead>
                                <TableHead>Auditor</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[150px]">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        Memuat...
                                    </TableCell>
                                </TableRow>
                            ) : sessions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Belum ada riwayat opname.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sessions.map((session) => (
                                    <TableRow key={session.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                {formatDate(session.date)}
                                            </div>
                                        </TableCell>
                                        <TableCell>{session.expand?.room?.name}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                {session.expand?.auditor?.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {session.status === "PENDING" ? (
                                                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200">
                                                    <Clock className="h-3 w-3 mr-1" /> Pending
                                                </Badge>
                                            ) : session.status === "APPLIED" ? (
                                                <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                                    <CheckCircle className="h-3 w-3 mr-1" /> Applied
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">{session.status}</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {session.status === "PENDING" && (
                                                <Button
                                                    size="sm"
                                                    className="gap-1"
                                                    onClick={() => handleApply(session.id)}
                                                >
                                                    <Save className="h-4 w-4" />
                                                    Terapkan
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
