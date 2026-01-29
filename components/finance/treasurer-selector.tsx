"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { assignSavingsTreasurer } from "@/actions/savings-admin";
import { showSuccess, showError } from "@/lib/toast";

interface TreasurerSelectorProps {
  currentTreasurer: any | null;
  employees: any[];
}

export function TreasurerSelector({ currentTreasurer, employees }: TreasurerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState(currentTreasurer?.id || "");

  const handleSelect = async (userId: string) => {
    setLoading(true);
    try {
      const res = await assignSavingsTreasurer(userId);
      if (res.success) {
        showSuccess(res.message || "Berhasil");
        setValue(userId);
        setOpen(false);
      } else {
        showError(res.error || "Gagal menetapkan bendahara");
      }
    } catch (error) {
       showError("Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  };

  const selectedEmployee = employees.find((emp) => emp.id === value);

  return (
    <Card className="relative overflow-hidden border-muted/40 dark:bg-zinc-900/50 backdrop-blur-sm group hover:border-primary/20 transition-all duration-300">
       <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
       <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <div className="w-24 h-24 bg-blue-500/20 rounded-full blur-2xl" />
       </div>
       
       <CardContent className="p-6 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center ring-1 ring-blue-500/20 shadow-sm">
                   <div className="h-6 w-6 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center">
                      {selectedEmployee ? selectedEmployee.name.charAt(0) : "?"}
                   </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Bendahara Tabungan Utama</h3>
                   <p className="text-sm text-muted-foreground">
                      {selectedEmployee ? `Saat ini: ${selectedEmployee.name}` : "Belum ada bendahara ditunjuk"}
                   </p>
                </div>
             </div>

            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full sm:w-[250px] justify-between border-muted/60 hover:border-primary/40 hover:bg-background/80"
                  disabled={loading}
                >
                  {value
                    ? employees.find((emp) => emp.id === value)?.name
                    : "Pilih Pegawai..."}
                  {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0">
                <Command>
                  <CommandInput placeholder="Cari pegawai..." />
                  <CommandList>
                      <CommandEmpty>Pegawai tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                      {employees.map((emp) => (
                          <CommandItem
                          key={emp.id}
                          value={emp.name || ""}
                          onSelect={() => {
                              if (emp.id) handleSelect(emp.id);
                          }}
                          >
                          <Check
                              className={cn(
                              "mr-2 h-4 w-4",
                              value === emp.id ? "opacity-100" : "opacity-0"
                              )}
                          />
                          {emp.name}
                          </CommandItem>
                      ))}
                      </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
       </CardContent>
    </Card>
  );
}
