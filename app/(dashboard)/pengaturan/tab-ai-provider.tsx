"use client";

import { useEffect, useState } from "react";
import {
    Sparkles,
    Plus,
    Trash2,
    Pencil,
    Globe,
    Cpu,
    Key,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

/** Preset provider populer — 9Router dulu karena provider utama sekolah (khusus). */
const PRESETS = [
    {
        name: "9Router",
        primary: true,
        providerType: "openai",
        baseUrl: "https://9router.com/api/v1",
        modelName: "9router/9router_server_dev",
        apiKeyEnvVar: "NINEROUTER_API_KEY",
    },
    {
        name: "OpenRouter",
        primary: false,
        providerType: "openai",
        baseUrl: "https://openrouter.ai/api/v1",
        modelName: "deepseek/deepseek-r1:free",
        apiKeyEnvVar: "OPENROUTER_API_KEY",
    },
    {
        name: "Google Gemini",
        primary: false,
        providerType: "gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        modelName: "gemini-2.5-flash",
        apiKeyEnvVar: "GEMINI_API_KEY",
    },
    {
        name: "Groq Cloud",
        primary: false,
        providerType: "openai",
        baseUrl: "https://api.groq.com/openai/v1",
        modelName: "llama-3.3-70b-versatile",
        apiKeyEnvVar: "GROQ_API_KEY",
    },
    {
        name: "DeepSeek API",
        primary: false,
        providerType: "openai",
        baseUrl: "https://api.deepseek.com/v1",
        modelName: "deepseek-chat",
        apiKeyEnvVar: "DEEPSEEK_API_KEY",
    },
    {
        name: "OpenAI",
        primary: false,
        providerType: "openai",
        baseUrl: "https://api.openai.com/v1",
        modelName: "gpt-4o-mini",
        apiKeyEnvVar: "OPENAI_API_KEY",
    },
] as const;

const EMPTY_FORM = {
    id: "",
    name: "",
    providerType: "openai",
    baseUrl: "",
    modelName: "",
    apiKeyEnvVar: "",
    apiKeyValue: "",
    isEnabled: true,
    priority: 1,
};

/** Sembunyikan API key — cukup 3 awal + 4 akhir (jangan tampilkan key utuh). */
function maskKey(key?: string): string {
    if (!key) return "";
    if (key.length <= 8) return "••••••••";
    return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

export default function TabAIProvider() {
    const [providers, setProviders] = useState<AIProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });

    const loadProviders = async () => {
        setLoading(true);
        try {
            const res: any = await goGet("/api/ai-providers");
            if (res?.data) setProviders(res.data);
        } catch {
            toast.error("Gagal memuat daftar AI Provider");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProviders();
    }, []);

    const openSheet = (provider?: AIProvider) => {
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
            setFormData({ ...EMPTY_FORM, priority: providers.length + 1, apiKeyEnvVar: "AI_API_KEY" });
        }
        setSheetOpen(true);
    };

    const applyPreset = (preset: (typeof PRESETS)[number]) => {
        setFormData((prev) => ({
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
        setSaving(true);
        try {
            if (editingProvider) {
                await goPut(`/api/ai-providers/${editingProvider.id}`, formData);
                toast.success("Provider AI berhasil diperbarui");
            } else {
                await goPost("/api/ai-providers", formData);
                toast.success("Provider AI baru berhasil ditambahkan");
            }
            setSheetOpen(false);
            loadProviders();
        } catch (err: any) {
            toast.error(err?.message || "Gagal menyimpan Provider AI");
        } finally {
            setSaving(false);
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
            toast.success(`Provider "${provider.name}" ${!provider.isEnabled ? "diaktifkan" : "dinonaktifkan"}`);
            loadProviders();
        } catch {
            toast.error("Gagal mengubah status provider");
        }
    };

    return (
        <div className="space-y-5">
            {/* Header — mobile first: judul di atas, tombol aksi selebar layar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 shrink-0 text-primary dark:text-purple-400" />
                        AI &amp; LLM
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Atur endpoint AI (9Router, OpenRouter, Gemini, Groq, DeepSeek, dll.) untuk fitur otomasi kecerdasan buatan sekolah.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="h-11 flex-1 sm:flex-none" onClick={loadProviders} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                        Muat Ulang
                    </Button>
                    <Button size="sm" className="h-11 flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 text-white" onClick={() => openSheet()}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Tambah
                    </Button>
                </div>
            </div>

            {/* Preset strip — horizontal scroll khas mobile, 9Router dulu + aksen khusus */}
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-secondary/10 to-accent/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-primary" />
                        Preset Cepat
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Ketuk preset untuk mengisi form secara otomatis.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                        {PRESETS.map((p) => (
                            <Button
                                key={p.name}
                                variant="secondary"
                                size="sm"
                                className={`h-9 shrink-0 text-xs whitespace-nowrap ${
                                    p.primary
                                        ? "border-2 border-purple-500/60 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-600 dark:bg-purple-950/40 dark:text-purple-300"
                                        : "border border-purple-500/20 bg-background/80 hover:border-purple-500/50"
                                }`}
                                onClick={() => {
                                    openSheet();
                                    setTimeout(() => applyPreset(p), 120);
                                }}
                            >
                                {p.primary && <Sparkles className="h-3 w-3 mr-1" />}
                                {p.name}
                                {p.primary && (
                                    <Badge className="ml-1.5 h-5 px-1.5 bg-purple-600 text-[9px] text-white" variant="secondary">
                                        Utama
                                    </Badge>
                                )}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Daftar provider — stacked vertical (mobile-first), tanpa grid 2 kolom */}
            {loading && providers.length === 0 ? (
                <div className="space-y-3">
                    {[0, 1].map((i) => (
                        <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/50" />
                    ))}
                </div>
            ) : providers.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-10 text-center">
                        <Server className="mx-auto h-9 w-9 text-muted-foreground/50" />
                        <p className="mt-3 text-sm font-medium">Belum ada provider AI</p>
                        <p className="mt-1 text-xs text-muted-foreground">Tambahkan provider atau pilih preset cepat di atas.</p>
                        <Button className="mt-4 h-11 bg-purple-600 hover:bg-purple-700" onClick={() => openSheet()}>
                            <Plus className="h-4 w-4 mr-1.5" /> Tambah Provider
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {providers.map((p) => (
                        <Card key={p.id} className={`transition-all ${p.isEnabled ? "border-purple-500/30 shadow-sm" : "opacity-60 bg-muted/30"}`}>
                            <CardContent className="p-4 space-y-3">
                                {/* Baris 1: nama + switch */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-bold text-base truncate">{p.name}</h3>
                                            <Badge variant={p.isEnabled ? "default" : "outline"} className={p.isEnabled ? "bg-purple-600" : ""}>
                                                Prioritas #{p.priority}
                                            </Badge>
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-muted-foreground font-mono truncate">ID: {p.id}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <span className="text-[11px] text-muted-foreground hidden sm:inline">{p.isEnabled ? "Aktif" : "Nonaktif"}</span>
                                        <Switch checked={p.isEnabled} onCheckedChange={() => handleToggleEnable(p)} aria-label={`Aktifkan ${p.name}`} />
                                    </div>
                                </div>

                                {/* Baris 2: info endpoint (mono, truncate) */}
                                <div className="space-y-1.5 rounded-lg border border-border/50 bg-muted/50 p-2.5 font-mono text-xs">
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
                                        <span className="truncate">
                                            {p.apiKeyValue ? `Direct Key ${maskKey(p.apiKeyValue)}` : `Env: ${p.apiKeyEnvVar || "AI_API_KEY"}`}
                                        </span>
                                    </div>
                                </div>

                                {/* Baris 3: status + aksi */}
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        {p.isEnabled ? (
                                            <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Aktif untuk AI Classifier &amp; Failover</>
                                        ) : (
                                            <><XCircle className="h-3.5 w-3.5 text-slate-400" /> Nonaktif</>
                                        )}
                                    </span>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" className="h-9 flex-1 sm:flex-none" onClick={() => openSheet(p)}>
                                            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 flex-1 sm:flex-none text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                            onClick={() => handleDelete(p.id, p.name)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Form tambah/edit — bottom sheet di mobile (rata layar), dialog lebar di layar besar */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
                    <SheetHeader>
                        <SheetTitle>{editingProvider ? "Edit Provider AI" : "Tambah Provider AI"}</SheetTitle>
                        <SheetDescription>Atur endpoint API, nama model, dan kunci API.</SheetDescription>
                    </SheetHeader>

                    <form id="ai-provider-form" onSubmit={handleSubmit} className="space-y-4">
                        {/* Preset dalam form (hanya saat menambah) */}
                        {!editingProvider && (
                            <div className="space-y-1.5">
                                <Label className="text-xs">Pilih Preset Cepat</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {PRESETS.map((preset) => (
                                        <Badge
                                            key={preset.name}
                                            variant="outline"
                                            className={`cursor-pointer py-1.5 px-2.5 text-xs hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950 ${
                                                preset.primary ? "border-purple-500/60 font-semibold" : ""
                                            }`}
                                            onClick={() => applyPreset(preset)}
                                        >
                                            {preset.primary && <Sparkles className="h-3 w-3 mr-1" />}
                                            {preset.name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Field mobile-first: satu kolom, tinggi sentuh44px+ */}
                        <div className="space-y-1.5">
                            <Label htmlFor="ai-name">Nama Provider *</Label>
                            <Input
                                id="ai-name"
                                required
                                autoComplete="off"
                                className="h-12"
                                placeholder="misal: 9Router / OpenRouter / Groq"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="ai-type">Tipe Provider</Label>
                                <Select value={formData.providerType} onValueChange={(val) => setFormData({ ...formData, providerType: val })}>
                                    <SelectTrigger id="ai-type" className="h-12">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="openai">OpenAI Compatible (9Router / Groq / OpenRouter)</SelectItem>
                                        <SelectItem value="gemini">Google Gemini API</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="ai-priority">Urutan Prioritas</Label>
                                <Input
                                    id="ai-priority"
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    className="h-12"
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="ai-baseurl">Base URL / Endpoint API *</Label>
                            <Input
                                id="ai-baseurl"
                                required
                                inputMode="url"
                                autoComplete="off"
                                spellCheck={false}
                                className="h-12 font-mono text-sm"
                                placeholder="https://9router.com/api/v1"
                                value={formData.baseUrl}
                                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Untuk 9Router gunakan <code className="rounded bg-muted px-1">https://9router.com/api/v1</code> atau URL proxy 9Router Anda.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="ai-model">Nama Model Default *</Label>
                            <Input
                                id="ai-model"
                                required
                                autoComplete="off"
                                spellCheck={false}
                                className="h-12 font-mono text-sm"
                                placeholder="misal: 9router/9router_server_dev"
                                value={formData.modelName}
                                onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="ai-envvar">Nama Env Variable Key</Label>
                            <Input
                                id="ai-envvar"
                                autoComplete="off"
                                spellCheck={false}
                                className="h-12 font-mono text-sm"
                                placeholder="misal: NINEROUTER_API_KEY"
                                value={formData.apiKeyEnvVar}
                                onChange={(e) => setFormData({ ...formData, apiKeyEnvVar: e.target.value })}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Sistem membaca kunci dari file <code className="rounded bg-muted px-1">.env</code> server berdasarkan nama variabel ini.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="ai-key">Atau Input Direct API Key (Opsional)</Label>
                            <Input
                                id="ai-key"
                                type="password"
                                autoComplete="new-password"
                                className="h-12 font-mono"
                                placeholder="Kosongkan jika memakai Env Variable"
                                value={formData.apiKeyValue}
                                onChange={(e) => setFormData({ ...formData, apiKeyValue: e.target.value })}
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <Label htmlFor="ai-enabled" className="text-sm font-medium">
                                Aktifkan provider ini
                            </Label>
                            <Switch
                                id="ai-enabled"
                                checked={formData.isEnabled}
                                onCheckedChange={(val) => setFormData({ ...formData, isEnabled: val })}
                            />
                        </div>
                    </form>

                    <SheetFooter className="gap-2 sm:gap-3">
                        <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => setSheetOpen(false)}>
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            form="ai-provider-form"
                            disabled={saving}
                            className="h-12 flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {saving ? "Menyimpan…" : editingProvider ? "Simpan Perubahan" : "Simpan Provider"}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}
