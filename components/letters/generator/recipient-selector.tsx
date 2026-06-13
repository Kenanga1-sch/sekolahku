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
    <Card>
      <CardHeader>
        <CardTitle>Target Penerima</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Jenis Target</Label>
          <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STUDENT">Siswa</SelectItem>
              <SelectItem value="STAFF">Guru / Staff</SelectItem>
              <SelectItem value="MANUAL">Manual (Ketik Nama)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {targetType !== "MANUAL" && (
          <div className="space-y-4">
            {targetType === "STUDENT" && (
              <div className="flex rounded-lg border p-1 bg-zinc-100 dark:bg-zinc-800">
                {["SINGLE", "MULTIPLE", "CLASS"].map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setRecipientMode(m as any);
                      setSelectedRecipients([]);
                      if (m === "CLASS") {
                        setSelectedClass("");
                        fetchClasses();
                      }
                    }}
                    className={cn(
                      "flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all",
                      recipientMode === m
                        ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m === "SINGLE" && "Perorangan"}
                    {m === "MULTIPLE" && "Pilih Banyak"}
                    {m === "CLASS" && "Satu Kelas"}
                  </button>
                ))}
              </div>
            )}

            {recipientMode === "CLASS" ? (
              <div className="space-y-2">
                <Label>Pilih Kelas</Label>
                <Select
                  value={selectedClass}
                  onValueChange={(v) => {
                    setSelectedClass(v);
                    fetchClassStudents(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kelas..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(classes.length > 0 ? classes : [1, 2, 3, 4, 5, 6].map((c) => ({ id: String(c), name: `Kelas ${c}` }))).map((kelas) => (
                      <SelectItem key={kelas.id || kelas.name} value={kelas.name || kelas.id}>
                        {kelas.name || kelas.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Cari {targetType === "STUDENT" ? "Siswa" : "Staff"}</Label>
                <Popover
                  open={isSearchOpen}
                  onOpenChange={(open) => {
                    setIsSearchOpen(open);
                    if (open && searchList.length === 0) searchItems("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {recipientMode === "SINGLE" && selectedRecipients.length > 0
                        ? selectedRecipients[0].name || selectedRecipients[0].fullName
                        : `Ketik nama ${targetType === "STUDENT" ? "siswa" : "staff"}...`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder={`Cari ${targetType === "STUDENT" ? "siswa" : "staff"}...`}
                        onValueChange={searchItems}
                      />
                      <CommandList>
                        {searchList.length === 0 && (
                          <CommandEmpty>
                            <span>Data tidak ditemukan</span>
                            <span className="block text-xs text-muted-foreground mt-1">
                              {targetType === "STUDENT" ? "Import siswa terlebih dahulu di menu Peserta Didik." : "Tambahkan data Guru/Staff di menu Admin > GTK."}
                            </span>
                          </CommandEmpty>
                        )}
                        {searchList.map((item) => (
                          <CommandItem key={item.id} value={item.id} onSelect={() => handleSelect(item)}>
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedRecipients.find((s) => s.id === item.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{item.name || item.fullName}</span>
                              <span className="text-xs text-muted-foreground">
                                {item.nisn || item.nip || "-"} - {item.className || item.position || item.jobType || item.role || ""}
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
              <div className="flex flex-wrap gap-2 pt-2">
                {selectedRecipients.slice(0, 15).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 text-xs px-2 py-1 rounded-full border"
                  >
                    {s.name || s.fullName}
                    {recipientMode === "MULTIPLE" && (
                      <button
                        onClick={() => setSelectedRecipients((prev) => prev.filter((x) => x.id !== s.id))}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {selectedRecipients.length > 15 && (
                  <span className="text-xs text-muted-foreground self-center">
                    ...dan {selectedRecipients.length - 15} lainnya
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
