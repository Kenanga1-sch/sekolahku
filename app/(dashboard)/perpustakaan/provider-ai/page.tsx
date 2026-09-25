"use client";

import { useEffect, useState } from "react";
import {
    Sparkles,
    Plus,
    Trash2,
    Pencil,
    Server,
    CheckCircle2,
    XCircle,
    ArrowLeft,
    Key,
    Globe,
    Cpu,
    RefreshCw
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import { toast } from "sonner";

interface AIProvider {
    id: string;
    name: string;
    providerType: string;
    baseUrl: string;
    modelName: string;
    apiKeyEnvVar: string;
    apiKeyValue: string;
    isEnabled: boolean;
    priority: number;
}

const PRESETS = [
    {
        name: "9Router",
        providerType: "openai",
        baseUrl: "https://9router.com/api/v1",
        modelName: "9router/9router_server_dev",
        apiKeyEnvVar: "NINEROUTER_API_KEY",
    },
    {
        name: "OpenRouter",
        providerType: "openai",
        baseUrl: "https://openrouter.ai/api/v1",
        modelName: "deepseek/deepseek-r1:free",
        apiKeyEnvVar: "OPENROUTER_API_KEY",
    },
    {
        name: "Google Gemini",
        providerType: "gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        modelName: "gemini-2.5-flash",
        apiKeyEnvVar: "GEMINI_API_KEY",
    },
    {
        name: "Groq Cloud",
        providerType: "openai",
        baseUrl: "https://api.groq.com/openai/v1",
        modelName: "llama-3.3-70b-versatile",
        apiKeyEnvVar: "GROQ_API_KEY",
    },
    {
        name: "DeepSeek API",
        providerType: "openai",
        baseUrl: "https://api.deepseek.com/v1",
        modelName: "deepseek-chat",
        apiKeyEnvVar: "DEEPSEEK_API_KEY",
    },
    {
        name: "OpenAI",
        providerType: "openai",
        baseUrl: "https://api.openai.com/v1",
        modelName: "gpt-4o-mini",
        apiKeyEnvVar: "OPENAI_API_KEY",
    },
];

export default function AIProviderConfigPage() {
    const [providers, setProviders] = useState<AIProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);

    const [formData, setFormData] = useState({
        id: "",
        name: "",
        providerType: "openai",
        baseUrl: "",
        modelName: "",
        apiKeyEnvVar: "",
        apiKeyValue: "",
        isEnabled: true,
        priority: 1,
    });

    const loadProviders = async () => {
        setLoading(true);
        try {
            const res: any = await goGet("/api/ai-providers");
            if (res?.data) {
                setProviders(res.data);
            }
        } catch {
            toast.error("Gagal memuat daftar AI Provider");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProviders();
    }, []);

    const openModal = (provider?: AIProvider) => {
        if (provider) {
            setEditingProvider(provider);
            setFormData({
                id: provider.id,
                name: provider.name,
                providerType: provider.providerType,
                baseUrl: provider.baseUrl,
                modelName: provider.modelName,
                apiKeyEnvVar: provider.apiKeyEnvVar,
                apiKeyValue: provider.apiKeyValue || "",
                isEnabled: provider.isEnabled,
                priority: provider.priority,
            });
        } else {
            setEditingProvider(null);
            setFormData({
                id: "",
                name: "",
                providerType: "openai",
                baseUrl: "",
                modelName: "",
                apiKeyEnvVar: "AI_API_KEY",
                apiKeyValue: "",
                isEnabled: true,
                priority: providers.length + 1,
            });
        }
        setDialogOpen(true);
    };

    const handleApplyPreset = (preset: typeof PRESETS[0]) => {
        setFormData(prev => ({
            ...prev,
            name: preset.name,
            providerType: preset.providerType,
            baseUrl: preset.baseUrl,
            modelName: preset.modelName,
            apiKeyEnvVar: preset.apiKeyEnvVar,
        }));
        toast.info(`Preset "${preset.name}" diterapkan`);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingProvider) {
                await goPut(`/api/ai-providers/${editingProvider.id}`, formData);
                toast.success("Provider AI berhasil diperbarui");
            } else {
                await goPost("/api/ai-providers", formData);
                toast.success("Provider AI baru berhasil ditambahkan");
            }
            setDialogOpen(false);
            loadProviders();
        } catch (err: any) {
            toast.error(err?.message || "Gagal menyimpan Provider AI");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Hapus provider AI "${name}"?`)) return;
        setLoading(true);
        try {
            await goDelete(`/api/ai-providers/${id}`);
            toast.success("Provider AI berhasil dihapus");
            loadProviders();
        } catch {
            toast.error("Gagal menghapus provider AI");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleEnable = async (provider: AIProvider) => {
        try {
            await goPut(`/api/ai-providers/${provider.id}`, {
                ...provider,
                isEnabled: !provider.isEnabled,
            });
            toast.success(`Provider "${provider.name}" ${!provider.isEnabled ? 'diaktifkan' : 'dinonaktifkan'}`);
            loadProviders();
        } catch {
            toast.error("Gagal mengubah status provider");
        }
    };

    return (
        <div className="container max-w-5xl py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/perpustakaan">
                        <Button variant="outline" size="icon" className="h-9 w-9">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                            Konfigurasi AI Provider Mandiri
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Atur endpoint AI (9Router, OpenRouter, Gemini, Groq, DeepSeek, dll.) untuk fitur otomasi kecerdasan buatan.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadProviders} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button onClick={() => openModal()} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
                        <Plus className="h-4 w-4" />
                        Tambah Provider Baru
                    </Button>
                </div>
            </div>

            {/* Presets Quick Add Banner */}
            <Card className="border-purple-500/20 bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-pink-500/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-purple-600" />
                        Preset Cepat Provider Populer
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Klik salah satu preset di bawah ini untuk mengisi form konfigurasi secara otomatis.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 pt-0">
                    {PRESETS.map((p) => (
                        <Button
                            key={p.name}
                            variant="secondary"
                            size="sm"
                            className="text-xs h-8 border border-purple-500/20 hover:border-purple-500/50 bg-background/80"
                            onClick={() => {
                                openModal();
                                setTimeout(() => handleApplyPreset(p), 100);
                            }}
                        >
                            + {p.name}
                        </Button>
                    ))}
                </CardContent>
            </Card>

            {/* Providers List Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map((p) => (
                    <Card key={p.id} className={`transition-all ${p.isEnabled ? "border-purple-500/30 shadow-sm" : "opacity-60 bg-muted/30"}`}>
                        <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-base">{p.name}</h3>
                                    <Badge variant={p.isEnabled ? "default" : "outline"} className={p.isEnabled ? "bg-purple-600" : ""}>
                                        Prioritas #{p.priority}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: {p.id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={p.isEnabled}
                                    onCheckedChange={() => handleToggleEnable(p)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs">
                            <div className="space-y-1.5 bg-muted/50 p-2.5 rounded-lg border border-border/50 font-mono">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Globe className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                                    <span className="truncate">{p.baseUrl || "(Default SDK Endpoint)"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Cpu className="h-3.5 w-3.5 shrink-0 text-pink-500" />
                                    <span className="truncate">{p.modelName || "(Default Model)"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Key className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                    <span>
                                        {p.apiKeyValue ? `Direct Key (${p.apiKeyValue})` : `Env: ${p.apiKeyEnvVar || "GEMINI_API_KEY"}`}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-1">
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    {p.isEnabled ? (
                                        <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Aktif untuk AI Classifier & Failover</>
                                    ) : (
                                        <><XCircle className="h-3.5 w-3.5 text-slate-400" /> Nonaktif</>
                                    )}
                                </span>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openModal(p)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => handleDelete(p.id, p.name)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Add / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>
                                {editingProvider ? "Edit Provider AI" : "Tambah Provider AI Baru"}
                            </DialogTitle>
                            <DialogDescription>
                                Atur endpoint API, nama model, dan nama variabel kunci API.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4 text-xs">
                            {/* Preset Picker inside Modal */}
                            {!editingProvider && (
                                <div className="space-y-1">
                                    <Label className="text-xs">Pilih Preset Cepat:</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {PRESETS.map((preset) => (
                                            <Badge
                                                key={preset.name}
                                                variant="outline"
                                                className="cursor-pointer hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950 py-1"
                                                onClick={() => handleApplyPreset(preset)}
                                            >
                                                {preset.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="name">Nama Provider *</Label>
                                <Input
                                    id="name"
                                    placeholder="misal: 9Router / OpenRouter / Groq"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="providerType">Tipe Provider</Label>
                                    <Select
                                        value={formData.providerType}
                                        onValueChange={(val) => setFormData({ ...formData, providerType: val })}
                                    >
                                        <SelectTrigger id="providerType">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="openai">OpenAI Compatible (9Router / Groq / OpenRouter)</SelectItem>
                                            <SelectItem value="gemini">Google Gemini API</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="priority">Urutan Prioritas</Label>
                                    <Input
                                        id="priority"
                                        type="number"
                                        min="1"
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="baseUrl">Base URL / Endpoint API *</Label>
                                <Input
                                    id="baseUrl"
                                    placeholder="https://9router.com/api/v1 atau https://openrouter.ai/api/v1"
                                    value={formData.baseUrl}
                                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                                    required
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Untuk 9Router gunakan `https://9router.com/api/v1` atau URL server proxy 9Router Anda.
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="modelName">Nama Model Default *</Label>
                                <Input
                                    id="modelName"
                                    placeholder="misal: 9router/9router_server_dev atau gpt-4o-mini"
                                    value={formData.modelName}
                                    onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="apiKeyEnvVar">Nama Env Variable Key</Label>
                                <Input
                                    id="apiKeyEnvVar"
                                    placeholder="misal: NINEROUTER_API_KEY / OPENROUTER_API_KEY"
                                    value={formData.apiKeyEnvVar}
                                    onChange={(e) => setFormData({ ...formData, apiKeyEnvVar: e.target.value })}
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Sistem akan membaca key dari file `.env` server berdasarkan nama variabel ini.
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="apiKeyValue">Atau Input Direct API Key (Opsional)</Label>
                                <Input
                                    id="apiKeyValue"
                                    type="password"
                                    placeholder="Kosongkan jika menggunakan Env Variable"
                                    value={formData.apiKeyValue}
                                    onChange={(e) => setFormData({ ...formData, apiKeyValue: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <Label htmlFor="isEnabled">Aktifkan Provider Ini</Label>
                                <Switch
                                    id="isEnabled"
                                    checked={formData.isEnabled}
                                    onCheckedChange={(val) => setFormData({ ...formData, isEnabled: val })}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white">
                                Simpan Provider
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
