"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { assignClassRep } from "@/actions/savings-admin";
import { showSuccess, showError } from "@/lib/toast";

interface ClassRepManagerProps {
  classes: any[];
  employees: any[];
}

export function ClassRepManager({ classes, employees }: ClassRepManagerProps) {
    return (
        <Card className="relative overflow-hidden border-muted/40 dark:bg-zinc-900/50 backdrop-blur-sm group hover:border-primary/20 transition-all duration-300">
             <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    Penanggung Jawab Kelas (Wali Kelas / PJ Tabungan)
                    <Badge variant="outline" className="text-muted-foreground">{classes.length} Kelas</Badge>
                </h3>
                <div className="rounded-md border bg-background/50">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama Kelas</TableHead>
                                <TableHead>Penanggung Jawab (PJ)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {classes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center h-24 text-muted-foreground">Belum ada data kelas.</TableCell>
                                </TableRow>
                            ) : (
                                classes.map((cls) => (
                                    <TableRow key={cls.id}>
                                        <TableCell className="font-medium">{cls.nama}</TableCell>
                                        <TableCell>
                                            <ClassRepSelector 
                                                classId={cls.id} 
                                                currentRepId={cls.waliKelasUser?.id} 
                                                employees={employees} 
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

function ClassRepSelector({ classId, currentRepId, employees }: { classId: string, currentRepId?: string, employees: any[] }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [value, setValue] = useState(currentRepId || "");
  
    const handleSelect = async (userId: string) => {
      setLoading(true);
      try {
        const res = await assignClassRep(classId, userId);
        if (res.success) {
          showSuccess(res.message);
          setValue(userId);
          setOpen(false);
        } else {
          showError(res.error || "Gagal update PJ");
        }
      } catch (error) {
         showError("Terjadi kesalahan sistem");
      } finally {
        setLoading(false);
      }
    };
  
    return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[200px] justify-between h-8"
              disabled={loading}
            >
              {value
                ? employees.find((emp) => emp.id === value)?.name
                : "Pilih PJ..."}
              {loading ? <Loader2 className="ml-2 h-3 w-3 animate-spin" /> : <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandInput placeholder="Cari..." className="h-8" />
              <CommandList>
                  <CommandEmpty>Tidak ditemukan.</CommandEmpty>
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
    );
  }
