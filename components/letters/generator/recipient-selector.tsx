"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { goGet } from "@/lib/api-client";
import { toast } from "sonner";

interface RecipientSelectorProps {
  targetType: "STUDENT" | "STAFF" | "MANUAL";
  setTargetType: (type: "STUDENT" | "STAFF" | "MANUAL") => void;
  recipientMode: "SINGLE" | "MULTIPLE" | "CLASS";
  setRecipientMode: (mode: "SINGLE" | "MULTIPLE" | "CLASS") => void;
  selectedRecipients: any[];
  setSelectedRecipients: (recipients: any[] | ((prev: any[]) => any[])) => void;
}

export function RecipientSelector({
  targetType,
  setTargetType,
  recipientMode,
  setRecipientMode,
  selectedRecipients,
  setSelectedRecipients,
}: RecipientSelectorProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchList, setSearchList] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);

  const normalizeList = (payload: any) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.data)) return payload.data.data;
    return [];
  };

  const searchItems = async (query: string) => {
    try {
      const endpoint = targetType === "STUDENT" ? "/api/students/simple-search" : "/api/master/employees";
      const data: any = await goGet(`${endpoint}?q=${query}`);
      setSearchList(normalizeList(data));
    } catch (e) {
      setSearchList([]);
    }
  };

  const fetchClassStudents = async (className: string) => {
    if (!className) return;
    try {
      const data: any = await goGet(`/api/students/simple-search?className=${className}`);
      const items = normalizeList(data);
      setSelectedRecipients(items);
      toast.success(`Berhasil memuat ${items.length} siswa dari ${className}`);
    } catch (e) {
      toast.error("Gagal memuat data kelas");
    }
  };

  const fetchClasses = async () => {
    if (classes.length > 0) return;
    try {
      const data: any = await goGet("/api/classes");
      const items = normalizeList(data);
      setClasses(items.length > 0 ? items : [1, 2, 3, 4, 5, 6].map((c) => ({ id: String(c), name: `Kelas ${c}` })));
    } catch (e) {
      setClasses([1, 2, 3, 4, 5, 6].map((c) => ({ id: String(c), name: `Kelas ${c}` })));
    }
  };

  const handleSelect = (item: any) => {
    if (recipientMode === "SINGLE") {
      setSelectedRecipients([item]);
      setIsSearchOpen(false);
    } else {
      setSelectedRecipients((prev) => {
        if (prev.find((x) => x.id === item.id)) return prev.filter((x) => x.id !== item.id);
        return [...prev, item];
      });
    }
  };

  return (
    <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-zinc-900">
      <CardHeader className="bg-slate-50/50 dark:bg-zinc-800/20 border-b border-slate-100 dark:border-slate-800/80 px-6 py-4">
        <CardTitle className="text-base text-slate-800 dark:text-slate-100 font-semibold">1. Tentukan Target Penerima</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">Pilih siapa siswa atau GTK yang akan menerima dokumen surat ini.</p>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Jenis Target Penerima</Label>
          <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
            <SelectTrigger className="w-full bg-white dark:bg-zinc-950 border-slate-200 dark:border-slate-800 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="STUDENT" className="rounded-lg">Siswa (Peserta Didik)</SelectItem>
              <SelectItem value="STAFF" className="rounded-lg">Guru / Tenaga Kependidikan</SelectItem>
              <SelectItem value="MANUAL" className="rounded-lg">Manual (Ketik Nama Sendiri)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {targetType !== "MANUAL" && (
          <div className="space-y-4 pt-1">
            {targetType === "STUDENT" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Metode Pemilihan</Label>
                <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 p-1 bg-slate-50 dark:bg-zinc-950">
                  {["SINGLE", "MULTIPLE", "CLASS"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setRecipientMode(m as any);
                        setSelectedRecipients([]);
                        if (m === "CLASS") {
                          setSelectedClass("");
                          fetchClasses();
                        }
                      }}
                      className={cn(
                        "flex-1 text-xs font-medium py-2 px-3 rounded-lg transition-all",
                        recipientMode === m
                          ? "bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400 font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m === "SINGLE" && "Perorangan"}
                      {m === "MULTIPLE" && "Pilih Banyak"}
                      {m === "CLASS" && "Satu Kelas"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {recipientMode === "CLASS" ? (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Pilih Kelas</Label>
                <Select
                  value={selectedClass}
                  onValueChange={(v) => {
                    setSelectedClass(v);
                    fetchClassStudents(v);
                  }}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-zinc-950 border-slate-200 dark:border-slate-800 rounded-xl">
                    <SelectValue placeholder="Pilih kelas..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {(classes.length > 0 ? classes : [1, 2, 3, 4, 5, 6].map((c) => ({ id: String(c), name: `Kelas ${c}` }))).map((kelas) => (
                      <SelectItem key={kelas.id || kelas.name} value={kelas.name || kelas.id} className="rounded-lg">
                        {kelas.name || kelas.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cari {targetType === "STUDENT" ? "Siswa" : "Guru / Staff"}
                </Label>
                <Popover
                  open={isSearchOpen}
                  onOpenChange={(open) => {
                    setIsSearchOpen(open);
                    if (open && searchList.length === 0) searchItems("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between bg-white dark:bg-zinc-950 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-normal text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-900">
                      {recipientMode === "SINGLE" && selectedRecipients.length > 0
                        ? selectedRecipients[0].name || selectedRecipients[0].fullName
                        : `Ketik nama ${targetType === "STUDENT" ? "siswa" : "staff"}...`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-slate-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[450px] p-0 rounded-xl border border-slate-200 dark:border-slate-850 shadow-lg overflow-hidden bg-white dark:bg-zinc-900">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder={`Cari ${targetType === "STUDENT" ? "siswa" : "staff"}...`}
                        onValueChange={searchItems}
                        className="border-none focus:ring-0 text-sm py-3"
                      />
                      <CommandList className="max-h-[300px]">
                        {searchList.length === 0 && (
                          <CommandEmpty className="py-6 text-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400 font-medium">Data tidak ditemukan</span>
                            <span className="block text-xs text-muted-foreground mt-1 px-4">
                              {targetType === "STUDENT" ? "Import siswa terlebih dahulu di menu Peserta Didik." : "Tambahkan data Guru/Staff di menu GTK."}
                            </span>
                          </CommandEmpty>
                        )}
                        {searchList.map((item) => (
                          <CommandItem key={item.id} value={item.id} onSelect={() => handleSelect(item)} className="p-2.5 m-1 rounded-lg cursor-pointer flex items-center gap-2">
                            <Check
                              className={cn(
                                "h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0",
                                selectedRecipients.find((s) => s.id === item.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col text-slate-800 dark:text-slate-250">
                              <span className="font-medium text-sm">{item.name || item.fullName}</span>
                              <span className="text-xs text-muted-foreground mt-0.5">
                                {item.nisn || item.nip || "-"} • {item.className || item.position || item.jobType || item.role || "Staf"}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {selectedRecipients.length > 0 && recipientMode !== "SINGLE" && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Daftar Penerima Terpilih ({selectedRecipients.length})
                </span>
                <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-xl bg-slate-50/50 dark:bg-zinc-950/20">
                  {selectedRecipients.slice(0, 15).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-1.5 bg-white dark:bg-zinc-850 text-xs text-slate-700 dark:text-slate-300 pl-2.5 pr-1.5 py-1 rounded-full border border-slate-200/60 dark:border-zinc-800 shadow-sm"
                    >
                      <span>{s.name || s.fullName}</span>
                      {recipientMode === "MULTIPLE" && (
                        <button
                          type="button"
                          onClick={() => setSelectedRecipients((prev) => prev.filter((x) => x.id !== s.id))}
                          className="text-muted-foreground hover:text-red-500 hover:bg-slate-100 dark:hover:bg-zinc-800 p-0.5 rounded-full transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {selectedRecipients.length > 15 && (
                    <span className="text-xs text-muted-foreground self-center px-1 font-medium">
                      ... dan {selectedRecipients.length - 15} lainnya
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
